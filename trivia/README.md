# Men’s Trip Trivia — v1.4.0

Phone-first multiplayer trivia for the San Francisco Men’s Trip 2026. The app runs on GitHub Pages and uses Firebase Authentication and Firestore.

## v1.4.0 changes

- Room-code entry is blank instead of showing `JAMES` as an example.
- Every player can **Leave Game** at any point and return to the start screen.
- A non-host player can **Claim Host** with a confirmation prompt if the original host is unavailable.
- Host control transfers live to all connected players; the crown and host controls update accordingly.
- Existing five-question gameplay, scoring, reveal photos, standings flow, alpha-only room codes, and End Game controls are unchanged.

## Important Firebase step

This release changes `firestore.rules` so players may remove their own player record when leaving and a current room player may claim host control. After deploying the code, copy the included `firestore.rules` into:

**Firebase Console → Firestore Database → Rules → Publish**

Without the updated rules, **Leave Game** and **Claim Host** will be denied by Firestore.

## Release files

- `index.html`
- `styles.css`
- `app.js`
- `firebase-service.js`
- `firebase-config.js`
- `questions.js`
- `firestore.rules`
- `images/reactions/`
- `README.md`

## GitHub Pages

Deploy from **main → /(root)**.

## Suggested v1.4.0 test

1. Create a room on Device A and join from Device B.
2. Start the game and confirm both devices can play normally.
3. On Device B, tap **Leave Game** and confirm it returns home and disappears from Device A’s player list.
4. Re-create a room with two players. On the non-host device, tap **Claim Host**, confirm the prompt, and verify host controls transfer immediately.
5. Confirm the previous host loses host-only controls.
6. Confirm a five-question game still completes normally.
