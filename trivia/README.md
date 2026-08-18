Men’s Trip Trivia v1.3.0

# Men’s Trip Trivia — v1.0.0

A simple phone-first multiplayer trivia game for the San Francisco Men’s Trip 2026. It runs directly on GitHub Pages and uses Firebase for rooms, players, answers, scoring, and the live scoreboard.

## Complete release files

- `index.html`
- `styles.css`
- `app.js`
- `firebase-service.js`
- `firebase-config.js`
- `questions.js`
- `firestore.rules`
- `README.md`

## v1.0.0 scope

- Nine validated questions imported from the Men’s Trip Trivia workbook
- Five rounds by default, with a nine-round option
- Existing create-room and join-room flow
- Host-controlled start, reveal, and next-round flow
- One point for each correct answer
- Final scoreboard
- Reveal button immediately disables after use to reduce duplicate-scoring risk

No categories, timers, free-text answers, host transfer, visual answer animations, architecture changes, or main-app integration are included.

## Question-bank note

The uploaded workbook contained ten filled question rows. Question ID 5, about the Philadelphia restaurant that left some of the group hungry, had no value in **Correct (A-D)**. It was excluded from this release rather than assigning an unverified answer. Add the correct letter to a future workbook upload and it can be included in the next release.

## Deploy

Replace all files in the repository root with the contents of this release. The repository root should directly show all eight files listed above.

## Firebase Authentication

In Firebase Console:

**Build → Authentication → Sign-in method → Anonymous → Enabled**

## Firestore rules

In Firebase Console:

**Build → Firestore Database → Rules**

Replace the editor contents with `firestore.rules`, then click **Publish**.

## GitHub Pages

In GitHub:

**Settings → Pages → Deploy from a branch → main → /(root) → Save**

After deployment, use a Private Browsing window on mobile Safari if the normal tab is still serving cached JavaScript.

## v1.0.0 test

1. On Phone 1, create a five-round room.
2. On Phone 2, join using the room code.
3. Confirm both players appear.
4. Start the game.
5. Submit answers from both phones.
6. Reveal the correct answer.
7. Confirm each correct player receives exactly one point.
8. Advance through all nine questions.
9. Confirm the final rankings are correct.

For now, create a new room for each game rather than using **Play Again**.

## Suggested commit comment

> Release Men’s Trip Trivia v1.0.0 with first validated question set


## v1.0.1

- Makes five rounds the default.
- Keeps nine rounds available.
- Fixes answer-listener lifecycle so host answer counts update reliably.
- Changes the submitted-answer copy to “You can still change it.”


## v1.2.0
- Replaced Jason's incorrect reaction image with the finished overlay version.
- Room codes are now five letters only.
- Hosts can end an active game early and immediately show final scores.
- Games remain fixed at five questions.


## v1.3.0
- Shows “Question X of 5” during every question.
- Reveal screen now identifies who got the question right and who missed it.
- Removes the scoreboard from the reveal screen.
- Adds a host-triggered Standings step between reveal and the next question.
- Hosts can still end the game from the question, reveal, or standings step.
