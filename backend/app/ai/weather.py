"""
Weather Integration (Phase 2)
==============================
Uses Open-Meteo API — completely free, no API key required.
API: https://api.open-meteo.com/v1/forecast

Provides pre-match weather forecast for known venue coordinates.
Falls back silently to default WeatherInfo if venue is unknown or API fails.

WMO Weather Code → condition mapping included for human-readable output.
"""
from __future__ import annotations

import logging
from datetime import datetime

import httpx

from app.ai.features import WeatherInfo

logger = logging.getLogger(__name__)

_BASE = "https://api.open-meteo.com/v1/forecast"
_TIMEOUT = httpx.Timeout(connect=5.0, read=8.0, write=5.0, pool=5.0)

# ── Major European stadium coordinates ───────────────────────────────────────
# Format: "Venue name (partial, lowercase)" -> (lat, lon)
VENUE_COORDS: dict[str, tuple[float, float]] = {
    # England
    "old trafford":           (53.4631,  -2.2913),
    "etihad":                 (53.4831,  -2.2004),
    "anfield":                (53.4308,  -2.9608),
    "stamford bridge":        (51.4816,  -0.1909),
    "emirates":               (51.5549,  -0.1084),
    "tottenham hotspur":      (51.6044,  -0.0660),
    "villa park":             (52.5090,  -1.8847),
    "st. james":              (54.9756,  -1.6218),
    "st james":               (54.9756,  -1.6218),
    "london stadium":         (51.5386,  -0.0161),
    "goodison":               (53.4388,  -2.9664),
    "king power":             (52.6204,  -1.1422),
    "molineux":               (52.5902,  -2.1302),
    "falmer":                 (50.8616,  -0.0837),
    "selhurst park":          (51.3983,  -0.0855),
    "bramall lane":           (53.3703,  -1.4706),
    "madejski":               (51.4225,  -0.9825),
    "bet365":                 (52.9884,  -2.1762),
    "carrow road":            (52.6223,   1.3092),
    "portman road":           (52.0551,   1.1451),
    # Spain
    "camp nou":               (41.3809,   2.1228),
    "spotify camp nou":       (41.3809,   2.1228),
    "santiago bernabeu":      (40.4531,  -3.6883),
    "bernabeu":               (40.4531,  -3.6883),
    "estadio metropolitano":  (40.4361,  -3.5995),
    "mestalla":               (39.4747,  -0.3582),
    "san mames":              (43.2641,  -2.9490),
    "estadio benito":         (37.3566,  -5.9726),
    "el madrigal":            (39.9443,  -0.0687),
    "ramon sanchez-pizjuan":  (37.3842,  -5.9704),
    "reale arena":            (43.3013,  -2.0025),
    # Germany
    "allianz arena":          (48.2188,  11.6248),
    "signal iduna":           (51.4926,   7.4518),
    "red bull arena":         (51.3456,  12.3479),
    "deutsche bank park":     (50.0687,   8.6455),
    "volksparkstadion":       (53.5870,   9.8987),
    "rhein energie":          (50.9338,   6.8751),
    "mercedes-benz arena":    (48.7922,   9.2324),
    "arena auf schalke":      (51.5549,   7.0672),
    # Italy
    "san siro":               (45.4781,   9.1236),
    "stadio olimpico":        (41.9336,  12.4547),
    "juventus stadium":       (45.1096,   7.6413),
    "allianz stadium":        (45.1096,   7.6413),
    "diego maradona":         (40.8278,  14.1928),
    "stadio artemio franchi": (43.7801,  11.2820),
    "stadio luigi ferraris":  (44.4156,   8.9124),
    "stadio ennio tardini":   (44.7941,  10.3316),
    # France
    "parc des princes":       (48.8414,   2.2530),
    "groupama":               (45.7654,   4.9820),
    "stade velodrome":        (43.2697,   5.3956),
    "stade de la mosson":     (43.6207,   3.8127),
    "stade raymond kopa":     (47.4676,  -0.5529),
    # Portugal
    "estadio da luz":         (38.7527,  -9.1845),
    "estadio do dragao":      (41.1616,  -8.5832),
    "estadio jose alvalade":  (38.7613,  -9.1609),
    # Netherlands
    "amsterdam arena":        (52.3141,   4.9416),
    "johan cruyff arena":     (52.3141,   4.9416),
    "philips stadion":        (51.4415,   5.4674),
    "de kuip":                (51.8941,   4.5234),
    # Scotland
    "ibrox":                  (55.8506,  -4.3093),
    "celtic park":            (55.8497,  -4.2057),
    # Defaults by country (fallback)
    "england":                (51.5074,  -0.1278),
    "spain":                  (40.4168,  -3.7038),
    "germany":                (52.5200,  13.4050),
    "italy":                  (41.9028,  12.4964),
    "france":                 (48.8566,   2.3522),
    "portugal":               (38.7223,  -9.1393),
    "scotland":               (55.9533,  -3.1883),
    "europe":                 (48.8566,   2.3522),
}

# WMO weather code → condition string
_WMO_CONDITIONS: dict[int, str] = {
    0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "rime fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain",
    71: "light snow", 73: "snow", 75: "heavy snow",
    77: "snow grains",
    80: "light showers", 81: "showers", 82: "heavy showers",
    85: "snow showers", 86: "heavy snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "heavy thunderstorm",
}

_PRECIPITATION_CODES = {51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99}


def _find_coords(venue_name: str | None, country: str | None) -> tuple[float, float] | None:
    """
    Fuzzy match venue name against known stadiums.
    Falls back to country capital if venue unknown.
    """
    if venue_name:
        lower = venue_name.lower()
        for key, coords in VENUE_COORDS.items():
            if key in lower or lower in key:
                return coords

    if country:
        lower = country.lower()
        if lower in VENUE_COORDS:
            return VENUE_COORDS[lower]

    return None


async def get_match_weather(
    venue_name: str | None,
    country: str | None,
    match_datetime: datetime,
) -> WeatherInfo:
    """
    Fetch weather forecast for a match venue.

    Uses Open-Meteo hourly forecast — no API key required.
    Returns default WeatherInfo on any failure.

    Args:
        venue_name:     Stadium name (e.g. "Anfield", "Camp Nou")
        country:        Country name for fallback coords
        match_datetime: UTC datetime of the match
    """
    coords = _find_coords(venue_name, country)
    if coords is None:
        logger.debug("No coords found for venue=%r country=%r — using default weather", venue_name, country)
        return WeatherInfo()

    lat, lon = coords
    date_str = match_datetime.strftime("%Y-%m-%d")

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(_BASE, params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "temperature_2m,precipitation_probability,weathercode,windspeed_10m",
                "start_date": date_str,
                "end_date": date_str,
                "timezone": "UTC",
            })
            if resp.status_code != 200 or not resp.content:
                return WeatherInfo()

            data = resp.json()
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            temps = hourly.get("temperature_2m", [])
            precip = hourly.get("precipitation_probability", [])
            codes = hourly.get("weathercode", [])
            winds = hourly.get("windspeed_10m", [])

            if not times:
                return WeatherInfo()

            # Find the closest hour to match time
            target_hour = match_datetime.strftime("%Y-%m-%dT%H:00")
            idx = 0
            for i, t in enumerate(times):
                if t <= target_hour:
                    idx = i

            temp = float(temps[idx]) if temps else 15.0
            precip_prob = float(precip[idx]) if precip else 0.0
            code = int(codes[idx]) if codes else 0
            wind = float(winds[idx]) if winds else 5.0
            condition = _WMO_CONDITIONS.get(code, "clear")
            is_precip = code in _PRECIPITATION_CODES or precip_prob > 50

            logger.debug(
                "Weather for %s/%s on %s: %.1f°C, %s, wind=%.1f km/h",
                venue_name, country, date_str, temp, condition, wind
            )

            return WeatherInfo(
                temperature=round(temp, 1),
                is_precipitation=is_precip,
                wind_speed=round(wind, 1),
                condition=condition,
            )

    except Exception as exc:
        logger.warning("Weather API error for %s: %s", venue_name, exc)
        return WeatherInfo()
