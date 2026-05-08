"""
Pre-Match Analysis Engine
=========================
Generates deep, structured AI analysis for a match.

Sections produced:
  1. team_overview      — form, momentum, tactical style, goal trends
  2. squad_analysis     — injuries, suspensions, missing impact, expected lineup shape
  3. tactical_matchup   — strength/weakness matrix, pressing, transitions
  4. historical         — H2H summary, venue trends
  5. narrative          — human-readable AI summary paragraph
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.schemas import InjuredPlayerInfo, TeamFormEntry, H2HResult

logger = logging.getLogger(__name__)


# ── Output dataclasses ─────────────────────────────────────────────────────────

@dataclass
class FormSummary:
    wins: int
    draws: int
    losses: int
    goals_scored: float       # avg per game last 5
    goals_conceded: float     # avg per game last 5
    form_string: str          # e.g. "W W D L W"
    momentum: float           # -1.0 to 1.0 (recent trend)
    clean_sheets: int         # last 5
    scored_in_all: bool       # scored in all last 5 games

@dataclass
class GoalTrends:
    avg_scored: float
    avg_conceded: float
    over_25_rate: float       # fraction of games with >2.5 goals
    btts_rate: float
    first_half_goals: float   # fraction of goals scored in 1st half
    late_goals: bool          # tends to score/concede 80+

@dataclass
class TacticalStyle:
    label: str               # e.g. "High Press", "Counter-Attack", "Possession"
    pressing_intensity: str  # "High" | "Medium" | "Low"
    defensive_line: str      # "Deep" | "Mid" | "High"
    build_up: str            # "Direct" | "Short" | "Mixed"
    avg_goals_per_game: float

@dataclass
class SquadAnalysis:
    injured: list[InjuredPlayerInfo]
    suspended: list[InjuredPlayerInfo]
    doubtful: list[InjuredPlayerInfo]
    missing_count: int
    impact_score: float      # 0–10, weighted by player importance
    lineup_shape: str        # e.g. "4-3-3", "4-2-3-1"
    key_absences: list[str]  # names of most important missing players

@dataclass
class TacticalMatchup:
    home_advantage_areas: list[str]   # e.g. ["Aerial duels", "Set pieces"]
    away_advantage_areas: list[str]
    key_battle: str                    # e.g. "Salah vs Alexander-Arnold"
    pressing_verdict: str              # who wins the pressing battle
    transition_edge: str               # "Home" | "Away" | "Even"
    xg_edge: str                       # "Home" | "Away" | "Even"
    danger_rating: float               # 0–10, overall match danger/excitement

@dataclass
class H2HSummary:
    total_meetings: int
    home_wins: int
    draws: int
    away_wins: int
    avg_total_goals: float
    last_3: list[str]        # e.g. ["Man City 2-1 Arsenal", ...]
    home_dominates: bool
    trend: str               # e.g. "High-scoring fixture historically"

@dataclass
class PreMatchAnalysis:
    home_form: FormSummary
    away_form: FormSummary
    home_goals: GoalTrends
    away_goals: GoalTrends
    home_style: TacticalStyle
    away_style: TacticalStyle
    home_squad: SquadAnalysis
    away_squad: SquadAnalysis
    matchup: TacticalMatchup
    h2h: H2HSummary
    narrative: str


# ── Helper computations ────────────────────────────────────────────────────────

def _form_summary(form: list[TeamFormEntry], team_name: str) -> FormSummary:
    """Compute FormSummary from last-N form entries."""
    recent = form[-5:] if len(form) >= 5 else form
    n = len(recent)
    if n == 0:
        return FormSummary(
            wins=0, draws=0, losses=0,
            goals_scored=1.2, goals_conceded=1.2,
            form_string="— — — — —", momentum=0.0,
            clean_sheets=0, scored_in_all=False,
        )

    wins   = sum(1 for e in recent if e.result == "W")
    draws  = sum(1 for e in recent if e.result == "D")
    losses = sum(1 for e in recent if e.result == "L")
    gf_avg = round(sum(e.goals_for   for e in recent) / n, 2)
    ga_avg = round(sum(e.goals_against for e in recent) / n, 2)
    clean  = sum(1 for e in recent if e.goals_against == 0)
    scored_all = all(e.goals_for > 0 for e in recent)

    # Momentum: weight recent results more heavily (index 0 = oldest)
    weights = [0.10, 0.15, 0.20, 0.25, 0.30] if n == 5 else [1/n] * n
    pts = {"W": 1.0, "D": 0.0, "L": -1.0}
    momentum = sum(weights[i] * pts[recent[i].result] for i in range(n))
    momentum = round(max(-1.0, min(1.0, momentum)), 2)

    result_map = {"W": "W", "D": "D", "L": "L"}
    form_str = " ".join(result_map.get(e.result, "—") for e in reversed(recent))

    return FormSummary(
        wins=wins, draws=draws, losses=losses,
        goals_scored=gf_avg, goals_conceded=ga_avg,
        form_string=form_str,
        momentum=momentum,
        clean_sheets=clean,
        scored_in_all=scored_all,
    )


def _goal_trends(form: list[TeamFormEntry]) -> GoalTrends:
    recent = form[-10:] if len(form) >= 10 else form
    n = len(recent)
    if n == 0:
        return GoalTrends(1.2, 1.2, 0.45, 0.50, 0.45, False)

    avg_scored    = round(sum(e.goals_for    for e in recent) / n, 2)
    avg_conceded  = round(sum(e.goals_against for e in recent) / n, 2)
    over25_count  = sum(1 for e in recent if (e.goals_for + e.goals_against) > 2.5)
    btts_count    = sum(1 for e in recent if e.goals_for > 0 and e.goals_against > 0)

    # Approximate: no half-time data from ESPN form, use heuristic
    first_half_rate = 0.45  # typical average
    late_goals = avg_scored > 1.5 or avg_conceded > 1.5

    return GoalTrends(
        avg_scored=avg_scored,
        avg_conceded=avg_conceded,
        over_25_rate=round(over25_count / n, 2),
        btts_rate=round(btts_count / n, 2),
        first_half_goals=first_half_rate,
        late_goals=late_goals,
    )


def _tactical_style(form: list[TeamFormEntry], elo: float) -> TacticalStyle:
    """Infer tactical style from form patterns + ELO."""
    recent = form[-5:] if len(form) >= 5 else form
    n = len(recent)
    if n == 0:
        return TacticalStyle("Balanced", "Medium", "Mid", "Mixed", 1.3)

    avg_gf = sum(e.goals_for   for e in recent) / n
    avg_ga = sum(e.goals_against for e in recent) / n
    total  = avg_gf + avg_ga

    if avg_gf > 2.0:
        label = "High-Press Attacking"
        pressing = "High"
        line = "High"
        build = "Short"
    elif avg_gf > 1.5 and avg_ga < 1.0:
        label = "Possession Control"
        pressing = "High"
        line = "High"
        build = "Short"
    elif avg_ga < 0.8:
        label = "Defensive Solid"
        pressing = "Low"
        line = "Deep"
        build = "Direct"
    elif avg_gf < 1.0 and avg_ga > 1.5:
        label = "Struggling"
        pressing = "Low"
        line = "Mid"
        build = "Mixed"
    elif total > 3.0:
        label = "Open / Counter-Attack"
        pressing = "Medium"
        line = "Mid"
        build = "Direct"
    else:
        label = "Balanced"
        pressing = "Medium"
        line = "Mid"
        build = "Mixed"

    # ELO boost labeling
    if elo > 1700:
        label = "Elite " + label

    return TacticalStyle(
        label=label,
        pressing_intensity=pressing,
        defensive_line=line,
        build_up=build,
        avg_goals_per_game=round(avg_gf, 2),
    )


def _squad_analysis(
    injuries: list[InjuredPlayerInfo],
    team_name: str,
) -> SquadAnalysis:
    injured_list    = [p for p in injuries if p.status == "injured"]
    suspended_list  = [p for p in injuries if p.status == "suspended"]
    doubtful_list   = [p for p in injuries if p.status == "doubtful"]

    missing = len(injured_list) + len(suspended_list)

    # Impact score: suspensions weighted more than injuries; positions matter
    impact = 0.0
    key_absences = []
    for p in (injured_list + suspended_list):
        pos_weight = {"GK": 2.0, "Goalkeeper": 2.0,
                      "DF": 1.5, "Defender": 1.5,
                      "MF": 1.2, "Midfielder": 1.2,
                      "FW": 1.5, "Forward": 1.5}.get(p.position or "", 1.0)
        base = 1.5 if p.status == "suspended" else 1.0
        impact += pos_weight * base
        if pos_weight >= 1.5:
            key_absences.append(p.name)

    impact = round(min(impact, 10.0), 1)

    # Lineup shape heuristic based on missing positions
    fwd_missing = sum(1 for p in injured_list + suspended_list
                      if p.position and ("FW" in p.position or "Forward" in p.position))
    def_missing = sum(1 for p in injured_list + suspended_list
                      if p.position and ("DF" in p.position or "Defender" in p.position))

    if def_missing >= 2:
        shape = "4-4-2 (defensive adjustment)"
    elif fwd_missing >= 2:
        shape = "4-5-1 (compact mid)"
    else:
        shape = "4-3-3"

    return SquadAnalysis(
        injured=injured_list,
        suspended=suspended_list,
        doubtful=doubtful_list,
        missing_count=missing,
        impact_score=impact,
        lineup_shape=shape,
        key_absences=key_absences[:3],
    )


def _tactical_matchup(
    home_style: TacticalStyle,
    away_style: TacticalStyle,
    home_form: FormSummary,
    away_form: FormSummary,
    home_squad: SquadAnalysis,
    away_squad: SquadAnalysis,
    home_elo: float,
    away_elo: float,
    home_name: str,
    away_name: str,
) -> TacticalMatchup:

    home_areas = []
    away_areas = []

    # ELO-based advantage
    elo_diff = home_elo - away_elo
    if elo_diff > 100:
        home_areas.append("Overall squad quality")
    elif elo_diff < -100:
        away_areas.append("Overall squad quality")

    # Form advantage
    if home_form.wins >= 3:
        home_areas.append("Recent momentum")
    if away_form.wins >= 3:
        away_areas.append("Recent momentum")
    if home_form.clean_sheets >= 2:
        home_areas.append("Defensive stability")
    if away_form.clean_sheets >= 2:
        away_areas.append("Defensive stability")
    if home_form.goals_scored > away_form.goals_scored + 0.5:
        home_areas.append("Attacking output")
    elif away_form.goals_scored > home_form.goals_scored + 0.5:
        away_areas.append("Attacking output")

    # Tactical matchup
    pressing_verdict = "Even pressing battle"
    if home_style.pressing_intensity == "High" and away_style.pressing_intensity != "High":
        pressing_verdict = f"{home_name} win the pressing duel"
        home_areas.append("Pressing intensity")
    elif away_style.pressing_intensity == "High" and home_style.pressing_intensity != "High":
        pressing_verdict = f"{away_name} win the pressing duel"
        away_areas.append("Pressing intensity")

    # Transition
    if home_style.build_up == "Direct" and away_style.defensive_line == "High":
        transition_edge = "Home"
    elif away_style.build_up == "Direct" and home_style.defensive_line == "High":
        transition_edge = "Away"
    else:
        transition_edge = "Even"

    # xG edge from squad impact
    if home_squad.impact_score > away_squad.impact_score + 2:
        xg_edge = "Away"   # home missing key players → away benefit
    elif away_squad.impact_score > home_squad.impact_score + 2:
        xg_edge = "Home"
    elif elo_diff > 50:
        xg_edge = "Home"
    elif elo_diff < -50:
        xg_edge = "Away"
    else:
        xg_edge = "Even"

    # Danger rating (0–10): both attacking + total goals expected
    avg_scored_combined = home_form.goals_scored + away_form.goals_scored
    danger = min(avg_scored_combined * 2.0 + max(0, 4 - (home_squad.impact_score + away_squad.impact_score) * 0.2), 10.0)
    danger = round(danger, 1)

    # Key battle (generic, based on styles)
    if "High-Press" in home_style.label:
        key_battle = f"{home_name}'s press vs {away_name}'s ball circulation"
    elif "Counter" in home_style.label or "Counter" in away_style.label:
        key_battle = f"Transition speed — {home_name}'s defence vs {away_name}'s counter"
    else:
        key_battle = f"Midfield control — set-piece threat could be decisive"

    if not home_areas:
        home_areas.append("Home advantage")
    if not away_areas:
        away_areas.append("Unpredictability")

    return TacticalMatchup(
        home_advantage_areas=home_areas[:4],
        away_advantage_areas=away_areas[:4],
        key_battle=key_battle,
        pressing_verdict=pressing_verdict,
        transition_edge=transition_edge,
        xg_edge=xg_edge,
        danger_rating=danger,
    )


def _h2h_summary(h2h: list[H2HResult], home_name: str) -> H2HSummary:
    n = len(h2h)
    if n == 0:
        return H2HSummary(0, 0, 0, 0, 2.6, [], False, "First or limited meetings — no clear H2H pattern")

    home_wins = sum(
        1 for m in h2h
        if (m.home_team == home_name and m.home_score > m.away_score)
        or (m.away_team == home_name and m.away_score > m.home_score)
    )
    draws  = sum(1 for m in h2h if m.home_score == m.away_score)
    away_wins = n - home_wins - draws
    avg_goals = round(sum(m.home_score + m.away_score for m in h2h) / n, 2)

    last_3 = []
    for m in reversed(h2h[-3:]):
        last_3.append(f"{m.home_team} {m.home_score}–{m.away_score} {m.away_team}")

    home_dom = home_wins > away_wins + 1

    if avg_goals > 3.0:
        trend = "High-scoring fixture historically"
    elif avg_goals < 2.0:
        trend = "Low-scoring, tight affair historically"
    elif draws > n // 2:
        trend = "Draw-heavy fixture historically"
    elif home_dom:
        trend = f"{home_name} historically dominant in this matchup"
    elif away_wins > home_wins + 1:
        trend = f"Away side historically strong in this fixture"
    else:
        trend = "Closely contested historically"

    return H2HSummary(
        total_meetings=n,
        home_wins=home_wins,
        draws=draws,
        away_wins=away_wins,
        avg_total_goals=avg_goals,
        last_3=last_3,
        home_dominates=home_dom,
        trend=trend,
    )


def _generate_narrative(
    home_name: str,
    away_name: str,
    home_form: FormSummary,
    away_form: FormSummary,
    home_goals: GoalTrends,
    away_goals: GoalTrends,
    home_style: TacticalStyle,
    away_style: TacticalStyle,
    home_squad: SquadAnalysis,
    away_squad: SquadAnalysis,
    matchup: TacticalMatchup,
    h2h: H2HSummary,
    home_elo: float,
    away_elo: float,
) -> str:
    parts = []

    # Opening — form
    if home_form.momentum > 0.3:
        parts.append(
            f"{home_name} arrives in strong form with {home_form.wins} wins from their last 5 "
            f"({home_form.form_string}), averaging {home_form.goals_scored:.1f} goals per game."
        )
    elif home_form.momentum < -0.2:
        parts.append(
            f"{home_name} comes into this match under pressure, winning only "
            f"{home_form.wins} of their last 5 ({home_form.form_string})."
        )
    else:
        parts.append(
            f"{home_name} enters this fixture with mixed recent form ({home_form.form_string}), "
            f"averaging {home_form.goals_scored:.1f} goals scored and "
            f"{home_form.goals_conceded:.1f} conceded per game."
        )

    # Away form contrast
    if away_form.momentum > 0.3 and home_form.momentum <= 0.3:
        parts.append(
            f"{away_name} will be confident following {away_form.wins} victories in 5 "
            f"({away_form.form_string}), with strong attacking momentum."
        )
    elif away_form.momentum < -0.2:
        parts.append(
            f"{away_name} travel with concerns after winning just {away_form.wins} "
            f"of their last 5 ({away_form.form_string})."
        )

    # Squad absences
    if home_squad.missing_count > 0:
        absence_str = (
            f", including {', '.join(home_squad.key_absences)}" if home_squad.key_absences else ""
        )
        parts.append(
            f"{home_name}'s squad is weakened by {home_squad.missing_count} absent player(s)"
            f"{absence_str}. This raises their missing impact score to "
            f"{home_squad.impact_score:.1f}/10."
        )
    if away_squad.missing_count > 0:
        absence_str = (
            f", including {', '.join(away_squad.key_absences)}" if away_squad.key_absences else ""
        )
        parts.append(
            f"{away_name} also face squad issues with {away_squad.missing_count} player(s) out"
            f"{absence_str}."
        )

    # Tactical styles
    if home_style.label != away_style.label:
        parts.append(
            f"Tactically, {home_name} operate as a '{home_style.label}' side "
            f"({home_style.pressing_intensity} press, {home_style.build_up.lower()} build-up) "
            f"against {away_name}'s '{away_style.label}' approach."
        )

    # Pressing matchup
    if "Even" not in matchup.pressing_verdict:
        parts.append(matchup.pressing_verdict + ".")

    # H2H
    if h2h.total_meetings >= 3:
        parts.append(
            f"The H2H record ({h2h.total_meetings} meetings: {h2h.home_wins}W {h2h.draws}D "
            f"{h2h.away_wins}L for {home_name}) tells us: {h2h.trend.lower()}. "
            f"Average goals in this fixture: {h2h.avg_total_goals:.1f}."
        )

    # Goals verdict
    if home_goals.over_25_rate > 0.6 and away_goals.over_25_rate > 0.6:
        parts.append("Both sides have been involved in high-scoring games recently — expect goals.")
    elif home_goals.btts_rate > 0.6 and away_goals.btts_rate > 0.6:
        parts.append("Both teams to score looks a strong possibility given recent patterns.")
    elif home_goals.avg_conceded < 0.8 and away_goals.avg_conceded < 0.8:
        parts.append("Both defences have been resilient recently — this could be a tight, low-scoring contest.")

    return " ".join(parts)


# ── Public API ─────────────────────────────────────────────────────────────────

def generate_pre_match_analysis(
    home_name: str,
    away_name: str,
    home_elo: float,
    away_elo: float,
    home_form_entries: list[TeamFormEntry],
    away_form_entries: list[TeamFormEntry],
    home_injuries: list[InjuredPlayerInfo],
    away_injuries: list[InjuredPlayerInfo],
    h2h_entries: list[H2HResult],
) -> PreMatchAnalysis:
    """
    Main entry point. Accepts raw data from the pipeline and
    returns a fully populated PreMatchAnalysis dataclass.
    """
    home_form   = _form_summary(home_form_entries, home_name)
    away_form   = _form_summary(away_form_entries, away_name)
    home_goals  = _goal_trends(home_form_entries)
    away_goals  = _goal_trends(away_form_entries)
    home_style  = _tactical_style(home_form_entries, home_elo)
    away_style  = _tactical_style(away_form_entries, away_elo)
    home_squad  = _squad_analysis(home_injuries, home_name)
    away_squad  = _squad_analysis(away_injuries, away_name)
    matchup     = _tactical_matchup(
        home_style, away_style,
        home_form, away_form,
        home_squad, away_squad,
        home_elo, away_elo,
        home_name, away_name,
    )
    h2h_sum     = _h2h_summary(h2h_entries, home_name)
    narrative   = _generate_narrative(
        home_name, away_name,
        home_form, away_form,
        home_goals, away_goals,
        home_style, away_style,
        home_squad, away_squad,
        matchup, h2h_sum,
        home_elo, away_elo,
    )

    return PreMatchAnalysis(
        home_form=home_form,
        away_form=away_form,
        home_goals=home_goals,
        away_goals=away_goals,
        home_style=home_style,
        away_style=away_style,
        home_squad=home_squad,
        away_squad=away_squad,
        matchup=matchup,
        h2h=h2h_sum,
        narrative=narrative,
    )
