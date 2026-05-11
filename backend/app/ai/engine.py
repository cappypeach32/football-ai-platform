"""
Football AI Prediction Engine
==============================
Ensemble combining:
  1. Poisson / Dixon-Coles goal distribution  (always available)
  2. XGBoost 1X2 classifier                   (loaded from app/ai/models/)
  3. XGBoost Over/Under 2.5 classifier        (loaded from app/ai/models/)

Blending weights (when XGBoost is available):
  1X2:   60% Poisson + 40% XGBoost
  O/U:   50% Poisson + 50% XGBoost

Post-hoc adjustments applied on top of the blend:
  - Injuries:  each missing key player reduces xG by ~5%
  - Weather:   precipitation reduces O2.5 probability, cold reduces scoring
  - Congestion: high fatigue (< 3 days rest) reduces xG by ~8%

Input:  Match ORM object + MatchFeatures (from app/ai/features.py)
Output: full prediction dict compatible with the Prediction model
"""
from __future__ import annotations

import logging
import math
import pickle
from pathlib import Path
from typing import Any

import numpy as np

from app.ai.features import MatchFeatures, XGB_FEATURE_NAMES
from app.config import settings

logger = logging.getLogger(__name__)


# ── Poisson / Dixon-Coles ─────────────────────────────────────────────────────

class PoissonModel:
    """Bivariate Poisson with Dixon-Coles low-score correction."""

    RHO = -0.13  # standard DC correlation

    def predict_score_matrix(self, home_xg: float, away_xg: float, max_goals: int = 8) -> np.ndarray:
        from scipy.stats import poisson  # type: ignore
        matrix = np.zeros((max_goals + 1, max_goals + 1))
        for h in range(max_goals + 1):
            for a in range(max_goals + 1):
                matrix[h, a] = poisson.pmf(h, home_xg) * poisson.pmf(a, away_xg)
        return self._dixon_coles_correction(matrix, home_xg, away_xg)

    def _dixon_coles_correction(self, matrix: np.ndarray, mu: float, nu: float) -> np.ndarray:
        rho = self.RHO
        corrections = {
            (0, 0): 1.0 - mu * nu * rho,
            (0, 1): 1.0 + mu * rho,
            (1, 0): 1.0 + nu * rho,
            (1, 1): 1.0 - rho,
        }
        for (h, a), factor in corrections.items():
            matrix[h, a] *= max(factor, 1e-6)
        return matrix

    def outcome_probs(self, matrix: np.ndarray) -> tuple[float, float, float]:
        home_win = float(np.sum(np.tril(matrix, -1)))
        draw     = float(np.trace(matrix))
        away_win = float(np.sum(np.triu(matrix, 1)))
        total    = home_win + draw + away_win
        return home_win / total, draw / total, away_win / total

    def over_under_probs(self, matrix: np.ndarray, line: float = 2.5) -> tuple[float, float]:
        over = float(sum(
            matrix[h, a]
            for h in range(matrix.shape[0])
            for a in range(matrix.shape[1])
            if h + a > line
        ))
        return over, 1.0 - over

    def btts_probs(self, matrix: np.ndarray) -> tuple[float, float]:
        btts = float(np.sum(matrix[1:, 1:]))
        return btts, 1.0 - btts

    def exact_score_top(self, matrix: np.ndarray, top_n: int = 5) -> list[dict]:
        scores = []
        for h in range(matrix.shape[0]):
            for a in range(matrix.shape[1]):
                scores.append({"home": h, "away": a, "prob": float(matrix[h, a])})
        return sorted(scores, key=lambda x: x["prob"], reverse=True)[:top_n]


# ── XGBoost loader ────────────────────────────────────────────────────────────

def _load_model(path: Path) -> Any | None:
    if not path.exists():
        return None
    try:
        with open(path, "rb") as f:
            model = pickle.load(f)
        logger.info("Loaded XGBoost model: %s", path.name)
        return model
    except Exception as exc:
        logger.warning("Could not load model %s: %s", path, exc)
        return None


# ── Main Engine ───────────────────────────────────────────────────────────────

class PredictionEngine:

    HOME_ADV_FACTOR = 1.15
    MODEL_VERSION   = "3.0.0"

    # Blend weights (Poisson vs XGBoost)
    XGB_WEIGHT_1X2 = 0.40   # 40% XGB, 60% Poisson
    XGB_WEIGHT_OU  = 0.50   # 50% XGB, 50% Poisson

    # Post-hoc adjustments
    INJURY_XG_PENALTY = 0.05     # -5% xG per missing player (capped at -20%)
    FATIGUE_XG_PENALTY = 0.08    # -8% xG when < 3 days rest
    RAIN_OU_PENALTY    = 0.04    # -4% Over 2.5 probability in rain
    COLD_XG_PENALTY    = 0.03    # -3% xG when < 5°C

    def __init__(self) -> None:
        self._poisson = PoissonModel()
        models_dir = Path(settings.MODEL_CACHE_DIR)
        models_dir.mkdir(parents=True, exist_ok=True)
        self._xgb_1x2 = _load_model(models_dir / "xgb_1x2.pkl")
        self._xgb_ou25 = _load_model(models_dir / "xgb_ou25.pkl")
        if self._xgb_1x2:
            logger.info("XGBoost 1X2 model active (blend weight %.0f%%)", self.XGB_WEIGHT_1X2 * 100)
        else:
            logger.info("XGBoost model not found — using Poisson-only mode")

    # ── Public API ────────────────────────────────────────────────────────────

    async def predict(self, match: Any, features: MatchFeatures | None = None) -> dict[str, Any]:
        """
        Generate full prediction for a match.

        Args:
            match:    Match ORM object with home_team, away_team loaded.
            features: Pre-computed MatchFeatures. If None, falls back to
                      DB-only (attack_strength / defense_weakness).
        """
        home_team = match.home_team
        away_team = match.away_team

        # ── 1. Compute xG ─────────────────────────────────────────────────────
        home_xg, away_xg = self._compute_xg(home_team, away_team, features)

        # ── 2. Poisson probabilities ──────────────────────────────────────────
        matrix = self._poisson.predict_score_matrix(home_xg, away_xg)
        p_hw, p_d, p_aw   = self._poisson.outcome_probs(matrix)
        p_over, p_under    = self._poisson.over_under_probs(matrix)
        p_btts, p_no_btts  = self._poisson.btts_probs(matrix)
        p_over_15, _       = self._poisson.over_under_probs(matrix, line=1.5)
        p_over_35, _       = self._poisson.over_under_probs(matrix, line=3.5)

        # ── 3. ELO adjustment ─────────────────────────────────────────────────
        elo_adj = self._elo_adjustment(home_team.elo_rating, away_team.elo_rating)
        p_hw = min(p_hw * elo_adj, 0.95)
        p_aw = max(p_aw / elo_adj, 0.03)
        total = p_hw + p_d + p_aw
        p_hw, p_d, p_aw = p_hw / total, p_d / total, p_aw / total

        # ── 4. XGBoost blend ──────────────────────────────────────────────────
        if features is not None and self._xgb_1x2 is not None:
            p_hw, p_d, p_aw = self._blend_1x2(features, p_hw, p_d, p_aw)

        if features is not None and self._xgb_ou25 is not None:
            p_over, p_under = self._blend_ou(features, p_over, p_under)

        # ── 5. Post-hoc adjustments ───────────────────────────────────────────
        if features is not None:
            home_xg, away_xg, p_over = self._apply_adjustments(
                home_xg, away_xg, p_over, features
            )
            # Recompute matrix with adjusted xG for BTTS / exact scores
            matrix = self._poisson.predict_score_matrix(home_xg, away_xg)
            p_btts, p_no_btts = self._poisson.btts_probs(matrix)
            p_over_15, _ = self._poisson.over_under_probs(matrix, line=1.5)
            p_over_35, _ = self._poisson.over_under_probs(matrix, line=3.5)

        # ── 6. Normalise final probs ──────────────────────────────────────────
        total = p_hw + p_d + p_aw
        p_hw, p_d, p_aw = p_hw / total, p_d / total, p_aw / total
        p_over = min(max(p_over, 0.05), 0.95)
        p_under = 1.0 - p_over
        p_btts = min(max(p_btts, 0.05), 0.95)

        # ── 7. Confidence & risk ──────────────────────────────────────────────
        confidence = self._confidence_score(p_hw, p_d, p_aw, home_team, away_team, features)
        risk = self._risk_score(confidence, features)

        # ── 7b. DC probabilities (derived from final normalised 1X2) ─────────
        p_dc_1x = p_hw + p_d
        p_dc_12 = p_hw + p_aw
        p_dc_x2 = p_d + p_aw

        # ── 8. Value bet detection ────────────────────────────────────────────
        recommended, is_value = self._value_detection(
            p_hw, p_d, p_aw, match, confidence,
            over25=p_over, under25=p_under,
            btts_yes=p_btts, btts_no=p_no_btts,
            over15=p_over_15, over35=p_over_35,
        )

        # ── 9. AI narrative ───────────────────────────────────────────────────
        summary, tactical, key_factors = self._generate_narrative(
            home_team, away_team, p_hw, p_d, p_aw, home_xg, away_xg, features
        )

        # ── 10. Exact score top-5 ─────────────────────────────────────────────
        top_scores = self._poisson.exact_score_top(matrix)

        return {
            "home_win_prob":    round(p_hw, 4),
            "draw_prob":        round(p_d, 4),
            "away_win_prob":    round(p_aw, 4),
            "over_25_prob":     round(p_over, 4),
            "under_25_prob":    round(p_under, 4),
            "over_15_prob":     round(p_over_15, 4),
            "under_15_prob":    round(1.0 - p_over_15, 4),
            "over_35_prob":     round(p_over_35, 4),
            "under_35_prob":    round(1.0 - p_over_35, 4),
            "btts_yes_prob":    round(p_btts, 4),
            "btts_no_prob":     round(p_no_btts, 4),
            "dc_1x_prob":       round(p_dc_1x, 4),
            "dc_12_prob":       round(p_dc_12, 4),
            "dc_x2_prob":       round(p_dc_x2, 4),
            "home_xg":          round(home_xg, 2),
            "away_xg":          round(away_xg, 2),
            "confidence_score": round(confidence, 1),
            "risk_score":       round(risk, 1),
            "value_bet":        is_value,
            "recommended_bet":  recommended,
            "ai_summary":       summary,
            "tactical_notes":   tactical,
            "key_factors":      key_factors,
            "top_scores":       top_scores,
            "odds_home":        getattr(match, "odds_home", None),
            "odds_draw":        getattr(match, "odds_draw", None),
            "odds_away":        getattr(match, "odds_away", None),
            "model_version":    self.MODEL_VERSION,
        }

    # ── xG computation ────────────────────────────────────────────────────────

    def _compute_xg(self, home_team: Any, away_team: Any, features: MatchFeatures | None) -> tuple[float, float]:
        if features is not None:
            # Form-adjusted xG: blend DB attack strength with recent form scoring rate
            db_home_xg = home_team.attack_strength * away_team.defense_weakness * self.HOME_ADV_FACTOR
            db_away_xg = away_team.attack_strength * home_team.defense_weakness

            form_home_xg = features.home_goals_scored_5 * (features.away_goals_conceded_5 / 1.2) * self.HOME_ADV_FACTOR
            form_away_xg = features.away_goals_scored_5 * (features.home_goals_conceded_5 / 1.2)

            # 40% DB stats + 60% recent form (form is more predictive)
            home_xg = 0.4 * db_home_xg + 0.6 * form_home_xg
            away_xg = 0.4 * db_away_xg + 0.6 * form_away_xg
        else:
            home_xg = home_team.attack_strength * away_team.defense_weakness * self.HOME_ADV_FACTOR
            away_xg = away_team.attack_strength * home_team.defense_weakness

        return max(0.3, min(home_xg, 4.5)), max(0.2, min(away_xg, 4.0))

    # ── ELO adjustment ────────────────────────────────────────────────────────

    def _elo_adjustment(self, home_elo: float, away_elo: float) -> float:
        diff = home_elo - away_elo
        expected = 1.0 / (1.0 + 10.0 ** (-diff / 400.0))
        return 0.6 + expected * 0.8  # [0.6, 1.4]

    # ── XGBoost blending ─────────────────────────────────────────────────────

    def _blend_1x2(
        self,
        features: MatchFeatures,
        p_hw: float, p_d: float, p_aw: float,
    ) -> tuple[float, float, float]:
        try:
            import pandas as pd
            X = pd.DataFrame([features.to_xgb_vector()], columns=XGB_FEATURE_NAMES)
            xgb_probs = self._xgb_1x2.predict_proba(X)[0]  # [P(H), P(D), P(A)]

            # Blend: (1-w)*Poisson + w*XGB
            w = self.XGB_WEIGHT_1X2
            blended = [
                (1 - w) * p_hw + w * float(xgb_probs[0]),
                (1 - w) * p_d  + w * float(xgb_probs[1]),
                (1 - w) * p_aw + w * float(xgb_probs[2]),
            ]
            total = sum(blended)
            return blended[0] / total, blended[1] / total, blended[2] / total
        except Exception as exc:
            logger.warning("XGB 1X2 blend failed: %s — using Poisson", exc)
            return p_hw, p_d, p_aw

    def _blend_ou(
        self, features: MatchFeatures, p_over: float, p_under: float
    ) -> tuple[float, float]:
        try:
            import pandas as pd
            X = pd.DataFrame([features.to_xgb_vector()], columns=XGB_FEATURE_NAMES)
            xgb_over = float(self._xgb_ou25.predict_proba(X)[0][1])
            w = self.XGB_WEIGHT_OU
            blended_over = (1 - w) * p_over + w * xgb_over
            return blended_over, 1.0 - blended_over
        except Exception as exc:
            logger.warning("XGB O/U blend failed: %s — using Poisson", exc)
            return p_over, p_under

    # ── Post-hoc adjustments ──────────────────────────────────────────────────

    def _apply_adjustments(
        self,
        home_xg: float,
        away_xg: float,
        p_over: float,
        features: MatchFeatures,
    ) -> tuple[float, float, float]:
        # Injuries (cap at -20%)
        h_missing = min(features.home_missing_total, 4)
        a_missing = min(features.away_missing_total, 4)
        home_xg *= (1.0 - h_missing * self.INJURY_XG_PENALTY)
        away_xg *= (1.0 - a_missing * self.INJURY_XG_PENALTY)

        # Fatigue (< 3 days rest)
        if features.home_days_rest < 3:
            home_xg *= (1.0 - self.FATIGUE_XG_PENALTY)
        if features.away_days_rest < 3:
            away_xg *= (1.0 - self.FATIGUE_XG_PENALTY)

        # Weather
        w = features.weather
        if w.is_precipitation:
            p_over -= self.RAIN_OU_PENALTY
        if w.temperature < 5.0:
            home_xg *= (1.0 - self.COLD_XG_PENALTY)
            away_xg *= (1.0 - self.COLD_XG_PENALTY)

        # Clamp
        home_xg = max(0.3, min(home_xg, 4.5))
        away_xg = max(0.2, min(away_xg, 4.0))
        p_over  = max(0.05, min(p_over, 0.95))

        return home_xg, away_xg, p_over

    # ── Confidence & risk ─────────────────────────────────────────────────────

    def _confidence_score(
        self,
        hw: float, d: float, aw: float,
        home: Any, away: Any,
        features: MatchFeatures | None,
    ) -> float:
        max_prob = max(hw, d, aw)
        entropy = -sum(p * math.log(p + 1e-9) for p in [hw, d, aw]) / math.log(3)
        elo_diff = abs(home.elo_rating - away.elo_rating)
        elo_bonus = min(elo_diff / 400.0, 0.2)

        base = max_prob * 65.0 + (1 - entropy) * 20.0 + elo_bonus * 10.0

        # Bonus for rich features
        if features is not None:
            # Clear form advantage
            form_diff = abs(features.home_form_pts_5 - features.away_form_pts_5)
            base += min(form_diff * 5.0, 6.0)

            # XGBoost available
            if self._xgb_1x2 is not None:
                base += 4.0

            # Injury asymmetry (one team much more affected)
            inj_diff = abs(features.home_missing_total - features.away_missing_total)
            if inj_diff >= 3:
                base += 2.0

        return min(max(base, 30.0), 98.0)

    def _risk_score(self, confidence: float, features: MatchFeatures | None) -> float:
        base = 100.0 - confidence

        if features is not None:
            # High injury count on either side increases risk
            total_missing = features.home_missing_total + features.away_missing_total
            base += min(total_missing * 2.0, 10.0)

            # Very short rest increases unpredictability
            if features.home_days_rest < 3 or features.away_days_rest < 3:
                base += 5.0

            # Bad weather = more variance
            if features.weather.is_precipitation:
                base += 3.0

        return min(max(base, 5.0), 90.0)

    # ── Value detection ───────────────────────────────────────────────────────

    def _value_detection(
        self, hw: float, d: float, aw: float, match: Any, confidence: float = 50.0,
        over25: float = 0.5, under25: float = 0.5,
        btts_yes: float = 0.5, btts_no: float = 0.5,
        over15: float = 0.5, over35: float = 0.5,
    ) -> tuple[str | None, bool]:
        # All candidate markets with their probabilities and corresponding odds attribute
        candidates: list[tuple[str, float, str | None]] = [
            ("1",          hw,       getattr(match, "odds_home",  None)),
            ("X",          d,        getattr(match, "odds_draw",  None)),
            ("2",          aw,       getattr(match, "odds_away",  None)),
            ("over_2.5",   over25,   None),
            ("under_2.5",  under25,  None),
            ("btts_yes",   btts_yes, None),
            ("btts_no",    btts_no,  None),
            ("over_1.5",   over15,   None),
            ("over_3.5",   over35,   None),
        ]

        # Pick 1X2 best as the primary recommended bet for display purposes
        best_1x2_prob = max(hw, d, aw)
        if best_1x2_prob == hw:
            recommended, primary_odds = "1", getattr(match, "odds_home", None)
        elif best_1x2_prob == aw:
            recommended, primary_odds = "2", getattr(match, "odds_away", None)
        else:
            recommended, primary_odds = "X", getattr(match, "odds_draw", None)

        is_value = False
        # Check ALL 1X2 markets for value edge (not just the recommended one)
        for _bet, _prob, _odds_attr in [("1", hw, getattr(match, "odds_home", None)),
                                        ("X", d,  getattr(match, "odds_draw", None)),
                                        ("2", aw, getattr(match, "odds_away", None))]:
            _odds = _odds_attr  # already the float value
            if _odds and _prob > 0:
                implied = 1.0 / _odds
                if _prob > implied * 1.03:  # 3% edge threshold
                    is_value = True
                    break
        # Fallback when odds unavailable: require clear probability edge + minimum confidence
        if not is_value and primary_odds is None:
            if best_1x2_prob >= 0.52 and confidence >= 45:
                is_value = True

        return recommended, is_value

    # ── Narrative ─────────────────────────────────────────────────────────────

    def _generate_narrative(
        self,
        home: Any, away: Any,
        hw: float, d: float, aw: float,
        home_xg: float, away_xg: float,
        features: MatchFeatures | None,
    ) -> tuple[str, str, list[str]]:
        """
        Produces a human-readable match story, tactical context string,
        and a list of specific key factor bullets.
        """
        # ── Helpers ──────────────────────────────────────────────────────────

        def _form_streak(form_list: list) -> tuple[int, str]:
            """Returns (streak_len, 'unbeaten' | 'winless' | 'winning' | 'losing')."""
            if not form_list:
                return 0, "unknown"
            results = [e.result for e in reversed(form_list)]
            if not results:
                return 0, "unknown"
            if results[0] == "W":
                n = sum(1 for r in results if r == "W")
                streak_type = "winning"
            elif results[0] == "L":
                n = sum(1 for r in results if r == "L")
                streak_type = "losing"
            else:
                # check unbeaten run
                n = 0
                for r in results:
                    if r != "L":
                        n += 1
                    else:
                        break
                streak_type = "unbeaten"
            # consecutive
            n = 0
            first = results[0]
            for r in results:
                if r == first:
                    n += 1
                else:
                    break
            return n, streak_type

        def _goals_avg(form_list: list, scored: bool) -> float:
            if not form_list:
                return 0.0
            vals = [e.goals_for if scored else e.goals_against for e in form_list[-5:]]
            return round(sum(vals) / len(vals), 2) if vals else 0.0

        def _h2h_summary(h2h: list, home_name: str, away_name: str) -> str | None:
            if not h2h or len(h2h) < 2:
                return None
            recent = h2h[-5:]
            home_w = sum(1 for r in recent
                         if r.home_team == home_name and r.home_score > r.away_score
                         or r.away_team == home_name and r.away_score > r.home_score)
            away_w = len(recent) - home_w - sum(1 for r in recent if r.home_score == r.away_score)
            draws  = len(recent) - home_w - away_w
            avg_goals = sum(r.home_score + r.away_score for r in recent) / len(recent)

            if home_w > away_w + 1:
                dom = f"{home_name} dominate the head-to-head"
            elif away_w > home_w + 1:
                dom = f"{away_name} have the upper hand historically"
            else:
                dom = "the head-to-head record is closely contested"

            return (
                f"In their last {len(recent)} meetings, {dom} "
                f"({home_w}W–{draws}D–{away_w}L for {home_name}). "
                f"Matches average {avg_goals:.1f} goals."
            )

        # ── Build narrative paragraphs ────────────────────────────────────────

        sentences: list[str] = []

        # 1. Opening: outcome expectation
        best_prob = max(hw, d, aw)
        if best_prob == hw:
            fav, fav_prob = home.name, hw
            underdog = away.name
        elif best_prob == aw:
            fav, fav_prob = away.name, aw
            underdog = home.name
        else:
            fav, fav_prob = None, d

        if fav and fav_prob >= 0.60:
            sentences.append(
                f"{fav} are the strong favourites at {fav_prob * 100:.0f}% — "
                f"the model sees this as a one-sided contest."
            )
        elif fav and fav_prob >= 0.45:
            sentences.append(
                f"{fav} hold a meaningful edge ({fav_prob * 100:.0f}% win probability), "
                f"though {underdog} remain a credible threat."
            )
        else:
            sentences.append(
                f"This is a genuinely open match — all three outcomes are in play "
                f"(1: {hw * 100:.0f}%, X: {d * 100:.0f}%, 2: {aw * 100:.0f}%)."
            )

        # 2. ELO context
        elo_diff = abs(home.elo_rating - away.elo_rating)
        if elo_diff >= 200:
            stronger = home.name if home.elo_rating > away.elo_rating else away.name
            sentences.append(
                f"The ELO gap of {elo_diff:.0f} points is significant — "
                f"{stronger} are rated considerably higher on recent performance."
            )
        elif elo_diff >= 80:
            stronger = home.name if home.elo_rating > away.elo_rating else away.name
            sentences.append(
                f"ELO ratings give a modest advantage to {stronger} "
                f"({home.elo_rating:.0f} vs {away.elo_rating:.0f})."
            )
        else:
            sentences.append(
                f"Both sides are closely matched on ELO "
                f"({home.elo_rating:.0f} vs {away.elo_rating:.0f})."
            )

        if features:
            # 3. Form narrative
            h_streak_n, h_streak_type = _form_streak(features.home_form)
            a_streak_n, a_streak_type = _form_streak(features.away_form)

            if h_streak_n >= 3:
                sentences.append(
                    f"{home.name} are on a {h_streak_n}-match {h_streak_type} run "
                    f"({features.home_form_string}), carrying strong momentum into this fixture."
                )
            elif h_streak_n >= 2:
                sentences.append(
                    f"{home.name} have been {h_streak_type} in their last {h_streak_n} matches "
                    f"({features.home_form_string})."
                )

            if a_streak_n >= 3:
                sentences.append(
                    f"{away.name} arrive {a_streak_type} in {a_streak_n} straight "
                    f"({features.away_form_string})."
                )
            elif a_streak_n >= 2:
                sentences.append(
                    f"{away.name} are {a_streak_type} across their last {a_streak_n} games "
                    f"({features.away_form_string})."
                )

            # PPG comparison
            ppg_diff = features.home_form_pts_5 - features.away_form_pts_5
            if abs(ppg_diff) >= 0.6:
                better = home.name if ppg_diff > 0 else away.name
                worse  = away.name if ppg_diff > 0 else home.name
                better_ppg = max(features.home_form_pts_5, features.away_form_pts_5)
                worse_ppg  = min(features.home_form_pts_5, features.away_form_pts_5)
                sentences.append(
                    f"Recent form strongly favours {better} "
                    f"({better_ppg:.2f} PPG vs {worse_ppg:.2f} for {worse})."
                )

            # 4. Attacking / defensive context
            h_scored = _goals_avg(features.home_form, scored=True)
            h_conceded = _goals_avg(features.home_form, scored=False)
            a_scored   = _goals_avg(features.away_form, scored=True)
            a_conceded = _goals_avg(features.away_form, scored=False)

            if h_scored >= 2.0:
                sentences.append(
                    f"{home.name} have been prolific at home, averaging {h_scored:.1f} goals per game recently."
                )
            if a_conceded >= 2.0:
                sentences.append(
                    f"{away.name}'s defence has been leaky on the road — conceding {a_conceded:.1f} per game."
                )
            if a_scored >= 2.0:
                sentences.append(
                    f"{away.name} bring genuine attacking threat, scoring {a_scored:.1f} goals per game in recent outings."
                )
            if h_conceded >= 2.0:
                sentences.append(
                    f"{home.name} have defensive concerns — they've been conceding {h_conceded:.1f} per match."
                )

            # 5. Expected goals interpretation
            xg_diff = home_xg - away_xg
            if abs(xg_diff) >= 0.7:
                xg_leader = home.name if xg_diff > 0 else away.name
                xg_trailer = away.name if xg_diff > 0 else home.name
                sentences.append(
                    f"The model expects {home_xg:.2f}–{away_xg:.2f} in expected goals, "
                    f"pointing to {xg_leader} as the more likely scorers."
                )
            else:
                sentences.append(
                    f"Expected goals are tight ({home_xg:.2f}–{away_xg:.2f}), "
                    f"suggesting a closely contested match in open play."
                )

            # 6. Injuries / suspensions
            h_miss = features.home_missing_total
            a_miss = features.away_missing_total
            if h_miss > 0 and a_miss > 0:
                sentences.append(
                    f"Availability concerns affect both sides: {home.name} are missing {h_miss} player(s), "
                    f"{away.name} are without {a_miss}."
                )
            elif h_miss >= 2:
                sentences.append(
                    f"{home.name} head into this match short-handed — {h_miss} player(s) unavailable, "
                    f"which is reflected in their reduced xG."
                )
            elif a_miss >= 2:
                sentences.append(
                    f"{away.name} travel with {a_miss} absentee(s), weakening their squad depth."
                )

            # 7. Fatigue / congestion
            if features.home_days_rest < 3 and features.away_days_rest >= 3:
                sentences.append(
                    f"{home.name} had only {features.home_days_rest:.0f} days since their last match — "
                    f"fatigue could be a factor."
                )
            elif features.away_days_rest < 3 and features.home_days_rest >= 3:
                sentences.append(
                    f"{away.name} are playing on short rest ({features.away_days_rest:.0f} days) — "
                    f"expect potential tiredness in the second half."
                )

            # 8. H2H
            h2h_str = _h2h_summary(features.h2h_results, home.name, away.name)
            if h2h_str:
                sentences.append(h2h_str)

            # 9. Weather
            w = features.weather
            if w.is_precipitation:
                sentences.append(
                    f"Rain is forecast — expect a more physical, direct game with scoring potentially suppressed."
                )
            elif w.temperature < 5:
                sentences.append(
                    f"Cold conditions ({w.temperature:.0f}°C) may affect the tempo and technical quality."
                )

        summary = " ".join(sentences)

        # ── Tactical context string ───────────────────────────────────────────
        if features:
            tactical_parts = [
                f"{home.name}: xG {home_xg:.2f} | "
                f"Scored {_goals_avg(features.home_form, True):.1f} | "
                f"Conceded {_goals_avg(features.home_form, False):.1f} per game recently.",
                f"{away.name}: xG {away_xg:.2f} | "
                f"Scored {_goals_avg(features.away_form, True):.1f} | "
                f"Conceded {_goals_avg(features.away_form, False):.1f} per game recently.",
                f"Form: {home.name} {features.home_form_string} | "
                f"{away.name} {features.away_form_string}",
            ]
            if features.home_missing_total or features.away_missing_total:
                tactical_parts.append(
                    f"Absences: {home.name} {features.home_missing_total} | "
                    f"{away.name} {features.away_missing_total}"
                )
        else:
            tactical_parts = [
                f"{home.name} vs {away.name} — limited pre-match data available.",
                f"ELO: {home.elo_rating:.0f} vs {away.elo_rating:.0f}.",
            ]

        tactical = " | ".join(tactical_parts)

        # ── Key factors ───────────────────────────────────────────────────────
        key_factors: list[str] = []

        # ELO
        if elo_diff >= 100:
            stronger = home.name if home.elo_rating > away.elo_rating else away.name
            key_factors.append(f"ELO edge: {stronger} leads by {elo_diff:.0f} pts")
        else:
            key_factors.append(f"Evenly matched on ELO ({elo_diff:.0f} pt gap)")

        # xG
        key_factors.append(f"Expected goals: {home.name} {home_xg:.2f} — {away.name} {away_xg:.2f}")

        if features:
            # Form PPG
            if abs(features.home_form_pts_5 - features.away_form_pts_5) >= 0.4:
                leader = home.name if features.home_form_pts_5 > features.away_form_pts_5 else away.name
                key_factors.append(
                    f"Form leader: {leader} "
                    f"({features.home_form_pts_5:.2f} vs {features.away_form_pts_5:.2f} PPG)"
                )

            # H2H win rate
            if features.h2h_results:
                key_factors.append(
                    f"H2H: {home.name} won {features.h2h_home_winrate * 100:.0f}% "
                    f"of last {min(len(features.h2h_results), 5)} meetings"
                )

            # Injuries
            if features.home_missing_total:
                key_factors.append(f"{home.name} missing {features.home_missing_total} player(s)")
            if features.away_missing_total:
                key_factors.append(f"{away.name} missing {features.away_missing_total} player(s)")

            # Fatigue
            if features.home_days_rest < 3:
                key_factors.append(f"{home.name} on {features.home_days_rest:.0f}-day rest (fatigue risk)")
            if features.away_days_rest < 3:
                key_factors.append(f"{away.name} on {features.away_days_rest:.0f}-day rest (fatigue risk)")

            # Weather
            if features.weather.is_precipitation:
                key_factors.append("Rain forecast — Under 2.5 & low-scoring match favoured")
            elif features.weather.temperature < 5:
                key_factors.append(f"Cold ({features.weather.temperature:.0f}°C) — expect sluggish tempo")

            # Over/Under hint based on avg goals
            avg_total = (
                _goals_avg(features.home_form, True) +
                _goals_avg(features.away_form, False) +
                _goals_avg(features.away_form, True) +
                _goals_avg(features.home_form, False)
            ) / 2
            if avg_total >= 2.8:
                key_factors.append(f"Combined recent avg {avg_total:.1f} goals — Over 2.5 supported")
            elif avg_total <= 1.8:
                key_factors.append(f"Combined recent avg {avg_total:.1f} goals — Under 2.5 lean")

            # Model signal
            if self._xgb_1x2 is not None:
                key_factors.append("XGBoost ensemble active (trained on 24k historical matches)")

        return summary, tactical, key_factors
