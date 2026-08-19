# Build 7.1

Updates the embedded Men's Trip Trivia game from v1.3.0 to v1.4.0.

Trivia updates included:
- Blank/neutral room-code entry field.
- Leave Game control for every player.
- Claim Host recovery control with confirmation.
- Latest v1.3.1 reveal-screen presentation: notes hidden; question shown above Correct Answer.
- Existing five-question format, alpha-only room codes, reaction images, standings flow, and End Game control retained.

The main San Francisco app structure and content are otherwise unchanged.
The main app service-worker cache is bumped to v7.1.

Important: Trivia v1.4.0 uses the updated Firestore rules that must be published in the separate Men's Trip Trivia Firebase project.
