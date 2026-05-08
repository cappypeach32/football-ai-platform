"""
XGBoost Model Training
======================
Trains football prediction models from 7 seasons of historical CSV data.

Data source: /Users/tomaszdravkov/football_analyzer/data_cache/*.csv
Format:      football-data.co.uk (free CSVs)
Coverage:    ~24,000 matches across 8+ European leagues

Models trained:
  xgb_1x2.pkl    — MulticlassClassifier: H(0) / D(1) / A(2)
  xgb_ou25.pkl   — BinaryClassifier:    Over 2.5 (1) / Under 2.5 (0)

Features (must stay in sync with app/ai/features.py XGB_FEATURE_NAMES):
  elo_home, elo_away, elo_diff
  home_form_pts_5, away_form_pts_5
  home_goals_scored_5, home_goals_conceded_5
  away_goals_scored_5, away_goals_conceded_5
  home_shots_5, away_shots_5
  h2h_home_winrate, h2h_draw_rate, h2h_avg_total_goals
  home_days_rest, away_days_rest

Usage:
    cd backend
    source .venv/bin/activate
    python train_xgboost.py
"""
from __future__ import annotations

import glob
import logging
import pickle
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import LabelEncoder

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
CSV_DIR    = Path("/Users/tomaszdravkov/football_analyzer/data_cache")
OUTPUT_DIR = Path("app/ai/models")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Feature column names (MUST match app/ai/features.py XGB_FEATURE_NAMES)
FEATURE_COLS = [
    "elo_home", "elo_away", "elo_diff",
    "home_form_pts_5", "away_form_pts_5",
    "home_goals_scored_5", "home_goals_conceded_5",
    "away_goals_scored_5", "away_goals_conceded_5",
    "home_shots_5", "away_shots_5",
    "h2h_home_winrate", "h2h_draw_rate", "h2h_avg_total_goals",
    "home_days_rest", "away_days_rest",
]


# ── ELO ───────────────────────────────────────────────────────────────────────

class EloTracker:
    K         = 20.0
    HOME_ADV  = 40.0
    INITIAL   = 1500.0

    def __init__(self) -> None:
        self.ratings: dict[str, float] = defaultdict(lambda: self.INITIAL)

    def get(self, team: str) -> float:
        return self.ratings[team]

    def update(self, home: str, away: str, fthg: int, ftag: int) -> tuple[float, float]:
        ra, rb = self.ratings[home], self.ratings[away]
        adj_ra = ra + self.HOME_ADV
        ea = 1.0 / (1.0 + 10.0 ** ((rb - adj_ra) / 400.0))
        gd = abs(fthg - ftag)
        k_mult = 1.0 if gd <= 1 else (1.1 if gd == 2 else min(1.1 + 0.05 * (gd - 2), 1.3))
        k = self.K * k_mult

        if fthg > ftag:
            sa = 1.0
        elif fthg == ftag:
            sa = 0.5
        else:
            sa = 0.0

        new_ra = ra + k * (sa - ea)
        new_rb = rb + k * ((1.0 - sa) - (1.0 - ea))
        self.ratings[home] = new_ra
        self.ratings[away] = new_rb
        return ra, rb   # return PRE-match ratings


# ── CSV loading ───────────────────────────────────────────────────────────────

def _parse_date(s: str) -> datetime | None:
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None


def load_csv(path: Path) -> pd.DataFrame | None:
    try:
        df = pd.read_csv(path, encoding="latin1", low_memory=False)
    except Exception as exc:
        logger.warning("Could not read %s: %s", path.name, exc)
        return None

    required = {"HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR", "Date"}
    if not required.issubset(df.columns):
        logger.debug("Skipping %s — missing columns", path.name)
        return None

    df = df.dropna(subset=list(required))
    df["_date"] = df["Date"].apply(_parse_date)
    df = df.dropna(subset=["_date"])
    df["FTHG"] = pd.to_numeric(df["FTHG"], errors="coerce")
    df["FTAG"] = pd.to_numeric(df["FTAG"], errors="coerce")
    df = df.dropna(subset=["FTHG", "FTAG"])
    df["FTHG"] = df["FTHG"].astype(int)
    df["FTAG"] = df["FTAG"].astype(int)
    return df.sort_values("_date").reset_index(drop=True)


# ── Feature extraction from a single league DataFrame ────────────────────────

def build_league_features(df: pd.DataFrame, elo: EloTracker, league_id: str) -> list[dict]:
    """
    Process one league DataFrame and return list of feature dicts.
    ELO state is mutated in-place (preserves cross-season continuity).
    """
    # Per-team rolling stats tracking (last 10 matches per team)
    team_history: dict[str, list[dict]] = defaultdict(list)
    # Per pair H2H tracking
    h2h_history: dict[tuple, list[dict]] = defaultdict(list)

    rows = []
    for _, row in df.iterrows():
        home = str(row["HomeTeam"]).strip()
        away = str(row["AwayTeam"]).strip()
        fthg = int(row["FTHG"])
        ftag = int(row["FTAG"])
        ftr  = str(row["FTR"]).strip()
        dt   = row["_date"]

        # Pre-match ELO
        elo_h, elo_a = elo.get(home), elo.get(away)

        # Rolling form (last 5 from each team's history, before this match)
        def form_stats(hist: list[dict], side: str) -> dict:
            recent = hist[-5:] if hist else []
            if not recent:
                return {"pts": 1.2, "gf": 1.3 if side == "home" else 1.1,
                        "ga": 1.1 if side == "home" else 1.3, "shots": 0.0}
            pts  = sum(m["pts"] for m in recent) / len(recent)
            gf   = sum(m["gf"] for m in recent)  / len(recent)
            ga   = sum(m["ga"] for m in recent)  / len(recent)
            shots= sum(m.get("shots", 0) for m in recent) / len(recent)
            return {"pts": pts, "gf": gf, "ga": ga, "shots": shots}

        home_stats = form_stats(team_history[home], "home")
        away_stats = form_stats(team_history[away], "away")

        # H2H (last 5 meetings between these two teams, regardless of venue)
        pair_key = tuple(sorted([home, away]))
        h2h_list = h2h_history[pair_key][-5:] if h2h_history[pair_key] else []
        if h2h_list:
            h2h_home_wins = sum(
                1 for m in h2h_list
                if (m["home"] == home and m["fthg"] > m["ftag"])
                or (m["away"] == home and m["ftag"] > m["fthg"])
            )
            h2h_draws = sum(1 for m in h2h_list if m["fthg"] == m["ftag"])
            h2h_total_goals = sum(m["fthg"] + m["ftag"] for m in h2h_list) / len(h2h_list)
            h2h_n = len(h2h_list)
        else:
            h2h_home_wins = 2    # neutral prior
            h2h_draws     = 1
            h2h_total_goals = 2.6
            h2h_n          = 5

        # Days rest
        last_home = team_history[home][-1]["date"] if team_history[home] else (dt - timedelta(days=7))
        last_away = team_history[away][-1]["date"] if team_history[away] else (dt - timedelta(days=7))
        home_rest = max(1.0, (dt - last_home).days)
        away_rest = max(1.0, (dt - last_away).days)

        # Build feature row
        hs = float(row.get("HS", 0) or 0)
        as_ = float(row.get("AS", 0) or 0)

        feat = {
            "elo_home":             round(elo_h, 1),
            "elo_away":             round(elo_a, 1),
            "elo_diff":             round(elo_h - elo_a, 1),
            "home_form_pts_5":      round(home_stats["pts"], 3),
            "away_form_pts_5":      round(away_stats["pts"], 3),
            "home_goals_scored_5":  round(home_stats["gf"], 3),
            "home_goals_conceded_5":round(home_stats["ga"], 3),
            "away_goals_scored_5":  round(away_stats["gf"], 3),
            "away_goals_conceded_5":round(away_stats["ga"], 3),
            "home_shots_5":         round(home_stats["shots"], 2),
            "away_shots_5":         round(away_stats["shots"], 2),
            "h2h_home_winrate":     round(h2h_home_wins / h2h_n, 3),
            "h2h_draw_rate":        round(h2h_draws / h2h_n, 3),
            "h2h_avg_total_goals":  round(h2h_total_goals, 2),
            "home_days_rest":       float(min(home_rest, 21)),
            "away_days_rest":       float(min(away_rest, 21)),
            # Targets
            "ftr":                  ftr,
            "total_goals":          fthg + ftag,
        }
        rows.append(feat)

        # ── Update history for next iteration ─────────────────────────────────
        home_pts = 3 if ftr == "H" else (1 if ftr == "D" else 0)
        away_pts = 3 if ftr == "A" else (1 if ftr == "D" else 0)

        team_history[home].append({"date": dt, "pts": home_pts, "gf": fthg, "ga": ftag,
                                    "shots": hs})
        team_history[away].append({"date": dt, "pts": away_pts, "gf": ftag, "ga": fthg,
                                    "shots": as_})
        h2h_history[pair_key].append({"home": home, "away": away, "fthg": fthg, "ftag": ftag})

        # Update ELO
        elo.update(home, away, fthg, ftag)

    return rows


# ── Main training loop ────────────────────────────────────────────────────────

def build_training_data() -> pd.DataFrame:
    csv_files = sorted(glob.glob(str(CSV_DIR / "*.csv")))
    logger.info("Found %d CSV files in %s", len(csv_files), CSV_DIR)

    # Group by league code (first part of filename, e.g. "E0" from "E0_2324.csv")
    by_league: dict[str, list[Path]] = defaultdict(list)
    for f in csv_files:
        code = Path(f).stem.split("_")[0]
        by_league[code].append(Path(f))

    all_rows: list[dict] = []
    elo_per_league: dict[str, EloTracker] = {}

    for league_code, files in by_league.items():
        elo = EloTracker()
        elo_per_league[league_code] = elo
        # Sort files by season (chronological)
        files_sorted = sorted(files, key=lambda p: p.stem)
        league_rows = 0

        for csv_path in files_sorted:
            df = load_csv(csv_path)
            if df is None or len(df) < 10:
                continue
            rows = build_league_features(df, elo, league_code)
            all_rows.extend(rows)
            league_rows += len(rows)

        logger.info("  League %-6s → %d matches across %d seasons",
                    league_code, league_rows, len(files_sorted))

    result = pd.DataFrame(all_rows)
    logger.info("Total training rows: %d", len(result))
    return result


def train_models(df: pd.DataFrame) -> None:
    # Filter to complete rows
    df = df.dropna(subset=FEATURE_COLS + ["ftr", "total_goals"])
    df = df[df["ftr"].isin(["H", "D", "A"])]
    logger.info("Training rows after filtering: %d", len(df))

    X = df[FEATURE_COLS].astype(np.float32).values
    y_1x2 = LabelEncoder().fit_transform(df["ftr"])  # H→0, D→1, A→2 (alphabetical)
    y_ou25 = (df["total_goals"] > 2.5).astype(int).values

    # Check label order
    le = LabelEncoder()
    le.fit(df["ftr"])
    logger.info("1X2 label encoding: %s → %s", list(le.classes_), list(range(len(le.classes_))))
    # Save encoder classes for reference
    np.save(str(OUTPUT_DIR / "label_classes.npy"), le.classes_)

    # Temporal split: last 15% by row as test (preserves time order)
    split = int(len(X) * 0.85)
    X_train, X_test = X[:split], X[split:]
    y1_train, y1_test = y_1x2[:split], y_1x2[split:]
    you_train, you_test = y_ou25[:split], y_ou25[split:]

    logger.info("Train: %d rows | Test: %d rows", len(X_train), len(X_test))

    # ── 1X2 Model ─────────────────────────────────────────────────────────────
    logger.info("Training XGBoost 1X2 model...")
    xgb_1x2 = XGBClassifier(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        use_label_encoder=False,
        eval_metric="mlogloss",
        n_jobs=-1,
        random_state=42,
        verbosity=0,
    )
    xgb_1x2.fit(
        X_train, y1_train,
        eval_set=[(X_test, y1_test)],
        verbose=False,
    )
    y1_pred = xgb_1x2.predict(X_test)
    acc_1x2 = accuracy_score(y1_test, y1_pred)
    logger.info("1X2 Accuracy: %.1f%%", acc_1x2 * 100)
    print("\n1X2 Classification Report:")
    print(classification_report(y1_test, y1_pred, target_names=["Home Win", "Draw", "Away Win"]))

    # Feature importance
    fi = sorted(zip(FEATURE_COLS, xgb_1x2.feature_importances_), key=lambda x: -x[1])
    logger.info("Top 5 features: %s", [(n, f"{v:.3f}") for n, v in fi[:5]])

    # ── O/U 2.5 Model ─────────────────────────────────────────────────────────
    logger.info("Training XGBoost Over/Under 2.5 model...")
    xgb_ou25 = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        use_label_encoder=False,
        eval_metric="logloss",
        n_jobs=-1,
        random_state=42,
        verbosity=0,
    )
    xgb_ou25.fit(
        X_train, you_train,
        eval_set=[(X_test, you_test)],
        verbose=False,
    )
    you_pred = xgb_ou25.predict(X_test)
    acc_ou = accuracy_score(you_test, you_pred)
    logger.info("O/U 2.5 Accuracy: %.1f%%", acc_ou * 100)
    print("\nO/U 2.5 Classification Report:")
    print(classification_report(you_test, you_pred, target_names=["Under 2.5", "Over 2.5"]))

    # ── Save models ────────────────────────────────────────────────────────────
    out_1x2  = OUTPUT_DIR / "xgb_1x2.pkl"
    out_ou25 = OUTPUT_DIR / "xgb_ou25.pkl"

    with open(out_1x2,  "wb") as f: pickle.dump(xgb_1x2,  f)
    with open(out_ou25, "wb") as f: pickle.dump(xgb_ou25, f)

    logger.info("✅  Saved:  %s", out_1x2)
    logger.info("✅  Saved:  %s", out_ou25)
    logger.info("Models ready — restart the backend to activate XGBoost blending.")


if __name__ == "__main__":
    print("=" * 60)
    print("Football XGBoost Trainer")
    print(f"CSV source: {CSV_DIR}")
    print(f"Output:     {OUTPUT_DIR}")
    print("=" * 60)

    df = build_training_data()
    train_models(df)
