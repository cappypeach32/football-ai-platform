export interface Team {
  id: number;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country: string | null;
  elo_rating: number;
  form_score: number;
  attack_strength: number;
  defense_weakness: number;
}

export interface League {
  id: number;
  name: string;
  country: string;
  logo_url: string | null;
  season: string | null;
  tier: number;
}

export interface Match {
  id: number;
  league: League;
  home_team: Team;
  away_team: Team;
  match_date: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  venue: string | null;
  stats: Record<string, unknown> | null;
}

export interface Prediction {
  id: number;
  match: Match;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  over_25_prob: number;
  under_25_prob: number;
  btts_yes_prob: number;
  btts_no_prob: number;
  home_xg: number;
  away_xg: number;
  confidence_score: number;
  risk_score: number;
  value_bet: boolean;
  recommended_bet: string | null;
  ai_summary: string | null;
  tactical_notes: string | null;
  key_factors: string[] | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  result: "win" | "draw" | "loss" | "pending";
  is_correct: boolean | null;
  profit_loss: number | null;
  model_version: string;
  created_at: string;
}

export interface InjuredPlayerInfo {
  name: string;
  position: string | null;
  status: string;
  detail: string | null;
  return_date: string | null;
  photo_url: string | null;
  chance_of_playing: number | null;
}

export interface H2HResult {
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  competition: string | null;
}

export interface TeamFormEntry {
  date: string;
  opponent: string;
  home_or_away: string;
  goals_for: number;
  goals_against: number;
  result: string;
  competition: string | null;
}

export interface MatchAnalysis {
  prediction: Prediction;
  home_injuries: InjuredPlayerInfo[];
  away_injuries: InjuredPlayerInfo[];
  home_form: TeamFormEntry[];
  away_form: TeamFormEntry[];
  head_to_head: H2HResult[];
  home_goals_scored_avg: number;
  home_goals_conceded_avg: number;
  away_goals_scored_avg: number;
  away_goals_conceded_avg: number;
  home_form_string: string;
  away_form_string: string;
  venue: string | null;
  referee: string | null;
}

export interface OddsSnapshot {
  timestamp: string;
  home: number;
  draw: number;
  away: number;
}

export interface OddsHistory {
  match_id: number;
  home_team: string;
  away_team: string;
  current: OddsSnapshot;
  history: OddsSnapshot[];
  movement: { home: "up" | "down" | "stable"; draw: "up" | "down" | "stable"; away: "up" | "down" | "stable" };
}

export interface BacktestSummary {
  total_predictions: number;
  correct_predictions: number;
  accuracy: number;
  roi: number;
  total_profit_loss: number;
  avg_confidence: number;
  by_league: Record<string, unknown>;
  by_confidence_tier: Record<string, { count: number; accuracy: number; roi: number }>;
  monthly_performance: Array<{ month: string; accuracy: number; roi: number }>;
}

// ── Pre-Match Analysis ────────────────────────────────────────────────────────

export interface FormSummary {
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  form_string: string;
  momentum: number;
  clean_sheets: number;
  scored_in_all: boolean;
}

export interface GoalTrends {
  avg_scored: number;
  avg_conceded: number;
  over_25_rate: number;
  btts_rate: number;
  first_half_goals: number;
  late_goals: boolean;
}

export interface TacticalStyle {
  label: string;
  pressing_intensity: "High" | "Medium" | "Low";
  defensive_line: "Deep" | "Mid" | "High";
  build_up: "Direct" | "Short" | "Mixed";
  avg_goals_per_game: number;
}

export interface SquadAnalysis {
  injured: InjuredPlayerInfo[];
  suspended: InjuredPlayerInfo[];
  doubtful: InjuredPlayerInfo[];
  missing_count: number;
  impact_score: number;
  lineup_shape: string;
  key_absences: string[];
}

export interface TacticalMatchup {
  home_advantage_areas: string[];
  away_advantage_areas: string[];
  key_battle: string;
  pressing_verdict: string;
  transition_edge: "Home" | "Away" | "Even";
  xg_edge: "Home" | "Away" | "Even";
  danger_rating: number;
}

export interface H2HSummary {
  total_meetings: number;
  home_wins: number;
  draws: number;
  away_wins: number;
  avg_total_goals: number;
  last_3: string[];
  home_dominates: boolean;
  trend: string;
}

export interface PreMatchAnalysis {
  home_name: string;
  away_name: string;
  home_form: FormSummary;
  away_form: FormSummary;
  home_goals: GoalTrends;
  away_goals: GoalTrends;
  home_style: TacticalStyle;
  away_style: TacticalStyle;
  home_squad: SquadAnalysis;
  away_squad: SquadAnalysis;
  matchup: TacticalMatchup;
  h2h: H2HSummary;
  narrative: string;
  home_form_entries: TeamFormEntry[];
  away_form_entries: TeamFormEntry[];
  head_to_head: H2HResult[];
  home_injuries_raw: InjuredPlayerInfo[];
  away_injuries_raw: InjuredPlayerInfo[];
  prediction: Prediction | null;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  subscription_plan: "free" | "premium" | "vip";
}

export interface EspnLiveMatch {
  type: string;
  match_external_id: string;
  name: string;
  state: "pre" | "in" | "post";
  completed: boolean;
  clock: string;
  period: number | null;
  status_name: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  home_logo: string;
  away_logo: string;
  venue: string | null;
  league_slug: string;
  league_name: string;
}

export interface EspnLiveResponse {
  live_matches: EspnLiveMatch[];
  count: number;
  connected_clients: number;
}

export interface LineupPlayer {
  name: string;
  position: string;
  position_name: string;
  jersey: string;
  starter: boolean;
  photo_url: string | null;
}

export interface TeamLineup {
  team: string;
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchLineup {
  home: TeamLineup | null;
  away: TeamLineup | null;
}

export interface LiveUpdate {
  match_id: number;
  minute: number;
  home_score: number;
  away_score: number;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  home_xg: number;
  away_xg: number;
  possession_home: number;
  shots_home: number;
  shots_away: number;
  dangerous_attacks_home: number;
  dangerous_attacks_away: number;
  momentum: number;
}
