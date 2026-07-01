# Pintly Product Ideas

## 1. Nearby Bar / Venue Detection

Priority note: keep this as a top candidate for the next venue/map accuracy pass.

When someone logs a beer, use their current GPS coordinates to suggest nearby venues instead of relying only on city/state or rough map clustering.

Potential approach:
- Get the user's current latitude/longitude from `expo-location`.
- Query a places/POI provider for nearby bars, breweries, pubs, taprooms, beer gardens, and restaurants.
- Show a lightweight confirmation picker such as "Looks like you're at Jack's Bar."
- Let the user confirm, pick another nearby place, or skip venue selection.
- Store a stable venue/place identifier on the check-in when confirmed.

Why it matters:
- Map pins could represent real venues instead of approximate GPS/city clusters.
- Visit counts could be based on actual venues and sessions.
- Pintly could support better stats later, like most visited bars, new venues, and venue-based group activity.

Open questions:
- Which provider should Pintly use: Google Places, Foursquare Places, Yelp Fusion, or another option?
- What radius should nearby search use: 75m, 100m, 150m?
- Should venue confirmation be required, optional, or only shown when confidence is high?
- How should Pintly handle GPS drift in dense areas with many nearby bars?

## 2. Venue Leaderboards

Now that beer logs can be tied to confirmed venues, Pintly could show leaderboards for who has logged the most beers at each venue.

Potential approach:
- Add a venue detail view from map pins, activity cards, or venue names.
- Show top Pintly users at that venue by confirmed beer logs.
- Support all-time and recent time windows, such as this month or this year.
- Let groups view venue leaderboards scoped to their members.
- Highlight a user's own rank at a venue after they confirm a beer there.

Why it matters:
- Makes venue logging feel meaningful beyond map accuracy.
- Creates friendly local competition around bars, breweries, and taprooms.
- Gives users a reason to confirm venues consistently.
- Opens up future features like venue badges, regulars, and group haunt stats.

Open questions:
- Should skipped/unconfirmed logs count toward venue leaderboards? Probably no.
- Should leaderboards count beers, visits, or both?
- Should users be able to hide themselves from public venue leaderboards?
- Should venue leaderboards be global, friends-only, group-only, or configurable?

## 3. Unlockable Profile Photo Rings

Let users unlock decorative rings around their profile photo based on the number of beers they have logged.

Potential approach:
- Define beer-count milestones, such as 10, 25, 50, 100, 250, 500, and 1,000 beers.
- Unlock a new profile ring style at each milestone.
- Show the active ring around the user's avatar in Profile, feeds, group leaderboards, and friend surfaces.
- Let users choose any ring they have already unlocked instead of forcing only the newest one.

Why it matters:
- Gives users a visible progression reward without changing the core logging flow.
- Makes activity feeds and leaderboards feel more personal.
- Creates lightweight status and collection goals that can grow over time.

Open questions:
- What should the ring styles be: colors, metal tiers, badges, animated rings, or beer-themed motifs?
- Should rings be based only on total beers, or should there also be special rings for cities, states, groups, or places visited?
- Should group-specific achievements unlock group-only rings?
- How should rings appear in light and dark themes without hurting avatar readability?

## 4. Public User Profiles

Priority note: keep this close behind venue detection because it unlocks more social discovery across groups and feeds.

Let users tap someone's profile photo or name to view a lightweight public profile.

Potential approach:
- Make avatars and names tappable in activity feeds, group member lists, leaderboards, friend surfaces, and reactions.
- Open a public profile screen for that user.
- Show all-time stats such as total beers, cities, states, groups, and challenge completions.
- Show badges or challenge stamps the user has earned.
- Optionally show recent public/group-visible activity where permissions allow it.

Why it matters:
- Makes Pintly feel more social and connected.
- Gives badges and stats more visibility outside the current user's own Profile tab.
- Helps group members understand who is active in a crew.

Open questions:
- What profile data should be public by default?
- Should users be able to hide stats, badges, or activity?
- Should non-friends see the same profile as friends/group members?
- Should tapping a user from a private group show only stats earned inside that shared group?

## 5. Comments on Beer Logs

Let users comment on beer logs in activity feeds.

Potential approach:
- Add a comment button next to reactions on activity cards.
- Show a comment thread for each beer log.
- Allow short text comments from friends or shared group members.
- Support deleting your own comments and possibly moderation for group founders.
- Show comment counts on feed cards.

Why it matters:
- Makes group activity more conversational.
- Gives users a way to ask what someone is drinking, where they are, or react beyond a heart.
- Helps crews feel alive between check-ins.

Open questions:
- Should comments be available globally, friends-only, or only inside shared groups?
- Should group founders be able to remove comments in their groups?
- Should comments trigger push notifications later?
- Should comments support mentions, photos, or only text at first?

## 6. Friends

Build out a full friends system so users can connect outside of groups.

Potential approach:
- Let users search for other Pintly users.
- Send, accept, and reject friend requests.
- Show friend activity on Home and Map.
- Add a Friends tab or a section inside Profile.
- Support privacy controls for what friends can see.

Why it matters:
- Lets Pintly work socially even when users are not in the same group.
- Makes activity feeds more useful for smaller friend circles.
- Creates a foundation for public profiles, comments, notifications, and invite flows.

Open questions:
- Should friends see all activity or only logs marked public/friends-visible?
- Should friend requests require both users to approve, or can following be one-way?
- Should friend discovery use username, phone contacts, invite links, or QR codes?
- How should blocking or removing friends work?
