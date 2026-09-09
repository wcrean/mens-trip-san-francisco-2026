# Build 7.2.0

Live weather feature.

Changes:
- Added live current San Francisco weather to the Weather section.
- Added an automatically updating five-day trip forecast for October 21–25 once those dates enter forecast range.
- Shows daily low, high, precipitation probability, and a simple condition label.
- Until the trip dates are in range, the table stays ready and explains that it will fill automatically.
- Added graceful error handling so a weather-service outage does not break the rest of the app.
- Live weather uses Open-Meteo and does not require an API key.
- Third-party weather responses are not cached by the service worker, so weather stays live.
- Bumped app version/cache to 7.2.0.
