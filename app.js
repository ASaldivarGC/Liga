// Global variables for Chart.js instances to allow their destruction and re-creation
let formChartInstance = null;
let pointsChartInstance = null;

// Your API Key and Base URL for the API-Sports Football API
const API_KEY = 'a0a2237e06c074bb980edb3e952c44d7'; // IMPORTANT: Replace with your actual API key
const BASE = 'https://v3.football.api-sports.io';
const headers = { 'x-apisports-key': API_KEY };

// Define the season you wish to fetch data for.
// NOTE: Free API-Sports plans often limit access to recent seasons (e.g., only up to 2023).
// If you have a paid plan, update this to '2025' or '2026' for current/upcoming seasons.
const SEASON_TO_FETCH = '2023';

// --- API Fetch Functions ---

/**
 * Fetches a list of all available leagues from the API.
 * Filters for 'league' type to exclude cups or other competition formats.
 * @returns {Array} An array of league objects.
 */
async function fetchAllLeagues() {
    try {
        console.log("Attempting to fetch all leagues...");
        const res = await fetch(`${BASE}/leagues`, { headers });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error(`API response NOT OK: ${res.status} ${res.statusText}. Body: ${errorBody.substring(0, 200)}`);
            throw new Error(`API error fetching leagues (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        
        const data = await res.json();
        console.log("Raw API response for /leagues:", data);

        if (data.response && data.response.length > 0) {
            console.log("Total items in data.response:", data.response.length);

            // *** CHANGE THIS LINE: RELAX THE FILTER ***
            const filteredLeagues = data.response.filter(l => l.id !== null); // Removed l.type === 'league'
            // *******************************************

            console.log("Filtered leagues (id!=null):", filteredLeagues);
            console.log("Number of filtered leagues:", filteredLeagues.length);

            if (filteredLeagues.length === 0) {
                console.warn("No leagues found after applying filter (id is null). This is unexpected if raw data has results.");
            }
            return filteredLeagues;
        } else {
            console.warn("API response.response is empty or not an array. No leagues found.");
            return [];
        }
    } catch (error) {
        console.error("Error in fetchAllLeagues (Caught):", error);
        throw error;
    }
}

/**
 * Fetches teams for a specific league and predefined season.
 * @param {string} league - The ID of the league.
 * @returns {Array} An array of team objects.
 */
async function fetchTeams(league) {
    try {
        const res = await fetch(`${BASE}/teams?league=${league}&season=${SEASON_TO_FETCH}`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching teams (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const data = await res.json();
        if (data.response && data.response.length > 0) {
            return data.response.map(t => ({ id: t.team.id, name: t.team.name, logo: t.team.logo }));
        } else {
            console.warn(`No teams found for league ${league} in season ${SEASON_TO_FETCH}. Check your API plan or season ID.`);
            return [];
        }
    } catch (error) {
        console.error("Error in fetchTeams:", error);
        throw error;
    }
}

/**
 * Fetches standings for a specific league and predefined season.
 * @param {string} league - The ID of the league.
 * @returns {Array} An array of standing entry objects.
 */
async function fetchStandings(league) {
    try {
        const res = await fetch(`${BASE}/standings?league=${league}&season=${SEASON_TO_FETCH}`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching standings (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const data = await res.json();
        // Standings data is usually nested within response[0].league.standings[0]
        if (data.response && data.response.length > 0 &&
            data.response[0].league && data.response[0].league.standings &&
            data.response[0].league.standings.length > 0) {
            return data.response[0].league.standings[0];
        } else {
            console.warn(`No standings found for league ${league} in season ${SEASON_TO_FETCH}. Check your API plan or season ID.`);
            return [];
        }
    } catch (error) {
        console.error("Error in fetchStandings:", error);
        throw error;
    }
}

/**
 * Fetches head-to-head fixtures between two teams.
 * @param {string} t1 - ID of Team 1.
 * @param {string} t2 - ID of Team 2.
 * @returns {Array} An array of fixture objects.
 */
async function fetchH2H(t1, t2) {
    try {
        const res = await fetch(`${BASE}/fixtures/headtohead?h2h=${t1}-${t2}`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching H2H data (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const data = await res.json();
        return data.response || []; // Return empty array if no response
    } catch (error) {
        console.error("Error in fetchH2H:", error);
        throw error;
    }
}

/**
 * Fetches the last 5 match results for a given team to determine their form.
 * @param {string} teamId - The ID of the team.
 * @returns {Array} An array of form outcomes ('W', 'L', 'D').
 */
async function fetchForm(teamId) {
    try {
        const res = await fetch(`${BASE}/fixtures?team=${teamId}&last=5`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching team form (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const json = await res.json();
        if (json.response) {
            return json.response.map(f => ({
                vs: f.teams.home.id === Number(teamId) ? f.teams.away.name : f.teams.home.name,
                outcome: f.teams.home.id === Number(teamId)
                    ? (f.goals.home > f.goals.away ? 'W' : f.goals.home < f.goals.away ? 'L' : 'D')
                    : (f.goals.away > f.goals.home ? 'W' : f.goals.away < f.goals.home ? 'L' : 'D')
            }));
        } else {
            console.warn(`No form data found for team ${teamId}.`);
            return [];
        }
    } catch (error) {
        console.error("Error in fetchForm:", error);
        throw error;
    }
}

/**
 * Fetches detailed match statistics for a specific fixture ID.
 * @param {string} fixtureId - The ID of the fixture.
 * @returns {Array} An array containing statistics for home and away teams.
 */
async function fetchMatchStatistics(fixtureId) {
    try {
        const res = await fetch(`${BASE}/fixtures/statistics?fixture=${fixtureId}`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching match statistics (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const data = await res.json();
        if (data.response && data.response.length > 0) {
            return data.response; // This will be an array of objects for home/away team stats
        } else {
            console.warn(`No statistics found for fixture ${fixtureId}.`);
            return [];
        }
    } catch (error) {
        console.error("Error in fetchMatchStatistics:", error);
        throw error;
    }
}

// --- UI Logic Functions ---

/**
 * Populates the initial league dropdown when the page loads.
 */
async function initialLoad() {
    const leagueSelect = document.getElementById('league');
    leagueSelect.innerHTML = '<option value="">Loading Leagues...</option>'; // Placeholder while loading

    try {
        const allLeagues = await fetchAllLeagues();
        leagueSelect.innerHTML = '<option value="">Select a League</option>'; // Reset with default option
        allLeagues.sort((a, b) => {
            const nameA = a.league.name ?? 'Unnamed League'; // Use fallback for robust sorting
            const nameB = b.league.name ?? 'Unnamed League'; // Use fallback for robust sorting
            return nameA.localeCompare(nameB); // Case-insensitive and handles special characters
        });
        allLeagues.forEach(l => {
            // Access properties correctly from the nested 'league' and 'country' objects
            const leagueId = l.league.id;
            const leagueName = l.league.name ?? 'Unnamed League'; // Fallback for name
            const countryName = l.country.name ?? 'Unknown Country'; // Fallback for country name

            // Create the option element with the correct values
            const option = new Option(`${leagueName} (${countryName})`, leagueId);
            leagueSelect.add(option);
        });

        // Optionally, auto-select a default league and load its teams after populating
        // Example: Select Premier League (ID 39) if available.
        // NOTE: The ID 39 refers to the l.league.id, not just l.id
        if (allLeagues.some(l => l.league.id == '39')) { // Use l.league.id here
             leagueSelect.value = '39';
             await loadTeams(); // Load teams for the pre-selected league
        }

    } catch (error) {
        console.error("Error loading leagues:", error);
        leagueSelect.innerHTML = '<option value="">Failed to load leagues</option>';
        alert("Failed to load leagues. Check your API key and internet connection.");
    }
}


/**
 * Loads teams for the currently selected league and populates the team dropdowns.
 */
async function loadTeams() {
    const league = document.getElementById('league').value;
    if (!league) {
        // Clear team dropdowns if no league is selected
        ['team1', 'team2'].forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = '<option value="">Select Team</option>';
        });
        return; // Exit if no league is selected
    }

    console.log("Loading teams for league:", league);

    try {
        const teams = await fetchTeams(league);
        console.log("Teams received:", teams);

        ['team1', 'team2'].forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = '<option value="">Select Team</option>'; // Clear and add default option
            teams.forEach(t => sel.add(new Option(t.name, t.id)));
        });
    } catch (error) {
        console.error("Error loading teams:", error);
        alert("Failed to load teams for the selected league. Data might not be available for the current season or your API key is invalid.");
    }
}

/**
 * Draws the Chart.js graphs for recent form and league points.
 * Destroys existing chart instances before creating new ones to prevent conflicts.
 * @param {Array} form1 - Form data for Team 1.
 * @param {Array} form2 - Form data for Team 2.
 * @param {number} pts1 - Points for Team 1.
 * @param {number} pts2 - Points for Team 2.
 */
function drawCharts(form1, form2, pts1, pts2) {
    // Destroy any existing chart instances to prevent conflicts
    if (formChartInstance) {
        formChartInstance.destroy();
    }
    if (pointsChartInstance) {
        pointsChartInstance.destroy();
    }

    // Re-create the charts and store their instances
    formChartInstance = new Chart(document.getElementById('formChart'), {
        type: 'bar',
        data: {
            labels: ['W', 'D', 'L'],
            datasets: [{
                label: 'Team 1',
                data: ['W', 'D', 'L'].map(x => form1.filter(f => f.outcome === x).length),
                backgroundColor: 'blue'
            }, {
                label: 'Team 2',
                data: ['W', 'D', 'L'].map(x => form2.filter(f => f.outcome === x).length),
                backgroundColor: 'red'
            }]
        },
        options: {
            plugins: { title: { display: true, text: 'Recent Form (last 5)' } },
            responsive: true,
            maintainAspectRatio: false // Crucial for responsive charts in flexbox
        }
    });

    pointsChartInstance = new Chart(document.getElementById('pointsChart'), {
        type: 'bar',
        data: {
            labels: ['Team 1', 'Team 2'],
            datasets: [{ label: 'Points', data: [pts1, pts2], backgroundColor: ['blue', 'red'] }]
        },
        options: {
            plugins: { title: { display: true, text: 'League Points Comparison' } },
            responsive: true,
            maintainAspectRatio: false // Crucial for responsive charts in flexbox
        }
    });
}

/**
 * Generates a simplified, rule-based prediction for a match based on provided statistics.
 * @param {string} team1Name - Name of Team 1.
 * @param {string} team2Name - Name of Team 2.
 * @param {number} pts1 - Points of Team 1.
 * @param {number} pts2 - Points of Team 2.
 * @param {Array} form1 - Recent form (W/L/D) of Team 1.
 * @param {Array} form2 - Recent form (W/L/D) of Team 2.
 * @param {Array} h2hMatches - Head-to-head match history.
 * @param {Array} matchStatistics - Detailed statistics of the most recent H2H match.
 * @returns {string} HTML string containing the prediction.
 */
function generatePrediction(team1Name, team2Name, pts1, pts2, form1, form2, h2hMatches, matchStatistics) {
    let predictionText = "";
    let team1Advantage = 0;
    let team2Advantage = 0;

    // Helper to safely get stat value
    const getStatValue = (statsArray, type) => {
        const stat = statsArray ? statsArray.find(s => s.type === type) : null;
        return stat && stat.value !== null ? stat.value : 'N/A';
    };

    // --- 1. Analyze League Points ---
    const pointsDiff = Math.abs(pts1 - pts2);
    if (pointsDiff > 10) { // Arbitrary threshold for significant point difference
        if (pts1 > pts2) {
            predictionText += `${team1Name} has a significant advantage in league points. `;
            team1Advantage += 2;
        } else {
            predictionText += `${team2Name} has a significant advantage in league points. `;
            team2Advantage += 2;
        }
    } else if (pointsDiff > 3) { // Smaller but noticeable difference
        if (pts1 > pts2) {
            predictionText += `${team1Name} has a slight edge in league points. `;
            team1Advantage += 1;
        } else {
            predictionText += `${team2Name} has a slight edge in league points. `;
            team2Advantage += 1;
        }
    } else {
        predictionText += `Both teams are closely matched in league points. `;
    }

    // --- 2. Analyze Recent Form (Wins in last 5 games) ---
    const form1Wins = form1.filter(f => f.outcome === 'W').length;
    const form2Wins = form2.filter(f => f.outcome === 'W').length;
    const formDiff = Math.abs(form1Wins - form2Wins);

    if (formDiff >= 2) { // Arbitrary threshold for significant form difference
        if (form1Wins > form2Wins) {
            predictionText += `${team1Name} comes into this match with better recent form (more wins in last 5 games). `;
            team1Advantage += 1.5;
        } else {
            predictionText += `${team2Name} comes into this match with better recent form (more wins in last 5 games). `;
            team2Advantage += 1.5;
        }
    } else if (formDiff === 1) {
        if (form1Wins > form2Wins) {
            predictionText += `${team1Name} has slightly better recent form. `;
            team1Advantage += 0.5;
        } else {
            predictionText += `${team2Name} has slightly better recent form. `;
            team2Advantage += 0.5;
        }
    } else {
        predictionText += `Their recent forms are quite similar. `;
    }

    // --- 3. Analyze Head-to-Head Record ---
    if (h2hMatches && h2hMatches.length > 0) {
        let h2hTeam1Wins = 0;
        let h2hTeam2Wins = 0;
        let h2hDraws = 0;

        // Get actual team IDs from the dropdowns for correct H2H win counting
        const team1Id = Number(document.getElementById('team1').value);
        const team2Id = Number(document.getElementById('team2').value);

        h2hMatches.forEach(match => {
            const homeTeamId = match.teams.home.id;
            const awayTeamId = match.teams.away.id;
            const homeGoals = match.goals.home;
            const awayGoals = match.goals.away;

            if (homeGoals > awayGoals) {
                if (homeTeamId === team1Id) h2hTeam1Wins++;
                else if (homeTeamId === team2Id) h2hTeam2Wins++;
            } else if (awayGoals > homeGoals) {
                if (awayTeamId === team1Id) h2hTeam1Wins++;
                else if (awayTeamId === team2Id) h2hTeam2Wins++;
            } else {
                h2hDraws++;
            }
        });

        const totalH2H = h2hMatches.length;
        predictionText += `In ${totalH2H} past head-to-head encounters: ${team1Name} won ${h2hTeam1Wins}, ${team2Name} won ${h2hTeam2Wins}, and there were ${h2hDraws} draws. `;

        if (h2hTeam1Wins > h2hTeam2Wins + 2) { // Arbitrary threshold for H2H dominance
            predictionText += `${team1Name} historically dominates this fixture. `;
            team1Advantage += 1;
        } else if (h2hTeam2Wins > h2hTeam1Wins + 2) {
            predictionText += `${team2Name} historically dominates this fixture. `;
            team2Advantage += 1;
        }
    } else {
        predictionText += `There is no significant head-to-head history to consider. `;
    }

    // --- Insights from Most Recent H2H Match Statistics ---
    let detailedPredictionHtml = '';
    if (matchStatistics && matchStatistics.length > 0) {
        // Ensure team IDs are numbers for comparison with matchStatistics.find
        const team1Id = Number(document.getElementById('team1').value);
        const team2Id = Number(document.getElementById('team2').value);

        const team1Stats = matchStatistics.find(s => s.team.id === team1Id);
        const team2Stats = matchStatistics.find(s => s.team.id === team2Id);

        let totalGoals = 'N/A';
        let totalShotsOnGoal = 'N/A';
        let totalCorners = 'N/A';
        let totalFouls = 'N/A';
        let totalPenalties = 'N/A';

        // Check if both teams have stats before summing
        if (team1Stats && team2Stats) {
            const goals1 = getStatValue(team1Stats.statistics, 'Goals');
            const goals2 = getStatValue(team2Stats.statistics, 'Goals');
            if (goals1 !== 'N/A' && goals2 !== 'N/A') totalGoals = goals1 + goals2;

            const shots1 = getStatValue(team1Stats.statistics, 'Shots on Goal');
            const shots2 = getStatValue(team2Stats.statistics, 'Shots on Goal');
            if (shots1 !== 'N/A' && shots2 !== 'N/A') totalShotsOnGoal = shots1 + shots2;

            const corners1 = getStatValue(team1Stats.statistics, 'Corner Kicks');
            const corners2 = getStatValue(team2Stats.statistics, 'Corner Kicks');
            if (corners1 !== 'N/A' && corners2 !== 'N/A') totalCorners = corners1 + corners2;

            const fouls1 = getStatValue(team1Stats.statistics, 'Fouls');
            const fouls2 = getStatValue(team2Stats.statistics, 'Fouls');
            if (fouls1 !== 'N/A' && fouls2 !== 'N/A') totalFouls = fouls1 + fouls2;

            const penalties1 = getStatValue(team1Stats.statistics, 'Penalties');
            const penalties2 = getStatValue(team2Stats.statistics, 'Penalties');
            if (penalties1 !== 'N/A' && penalties2 !== 'N/A') totalPenalties = penalties1 + penalties2;
        }

        detailedPredictionHtml = `
            <h4>Insights from Last H2H Match:</h4>
            <ul>
                <li>Total Goals: ${totalGoals}</li>
                <li>Total Shots on Goal: ${totalShotsOnGoal}</li>
                <li>Corner Kicks: ${totalCorners}</li>
                <li>Fouls Committed: ${totalFouls}</li>
                <li>Penalties: ${totalPenalties}</li>
            </ul>
            <p>Based on their most recent direct encounter, we might observe a similar pattern in goal-scoring opportunities, set pieces, and physicality in their next match.</p>
        `;
    } else {
        detailedPredictionHtml = "<p>No detailed match statistics available from past head-to-head encounters to provide further insights into specific match events.</p>";
    }

    // --- Final Combined Prediction ---
    let finalOutcome = "";
    if (team1Advantage > team2Advantage + 1) { // Team 1 has a clear advantage
        finalOutcome = `${team1Name} is favored to win this match.`;
    } else if (team2Advantage > team1Advantage + 1) { // Team 2 has a clear advantage
        finalOutcome = `${team2Name} is favored to win this match.`;
    } else if (team1Advantage > 0.5 || team2Advantage > 0.5) { // One team has a slight edge overall
        finalOutcome = `${team1Advantage > team2Advantage ? team1Name : team2Name} has a slight edge, but it could be a close game.`;
    } else { // Very evenly matched
        finalOutcome = `This looks like a very evenly matched game, a draw is a strong possibility.`;
    }

    return `
        <p><strong>Based on overall stats:</strong> ${predictionText}</p>
        ${detailedPredictionHtml}
        <h3>Match Outcome Prediction: ${finalOutcome}</h3>
        <p class="disclaimer"><em>(Disclaimer: This is a simplified, rule-based prediction based on limited available data, and should not be used for betting purposes. Football matches are highly unpredictable!)</em></p>
    `;
}

/**
 * Handles the comparison logic when the "Compare" button is clicked.
 * Fetches all necessary data and updates the UI.
 */
async function compare() {
    const league = document.getElementById('league').value;
    const t1 = document.getElementById('team1').value;
    const t2 = document.getElementById('team2').value;

    const out = document.getElementById('output'); // Get output element once

    // Basic input validation: ensure both teams are selected
    if (!league || !t1 || !t2) {
        out.innerHTML = `
            <h2>Comparison Error</h2>
            <p>Please select a League, Team 1, and Team 2 to perform a comparison.</p>
        `;
        if (formChartInstance) formChartInstance.destroy();
        if (pointsChartInstance) pointsChartInstance.destroy();
        return; // Stop execution if inputs are not valid
    }

    try {
        // Fetch all necessary data concurrently using Promise.all
        const [stand, h2h, form1, form2] = await Promise.all([
            fetchStandings(league),
            fetchH2H(t1, t2),
            fetchForm(t1),
            fetchForm(t2),
        ]);

        // Find the standing data for each selected team
        const a = stand.find(r => r.team.id === Number(t1));
        const b = stand.find(r => r.team.id === Number(t2));

        // --- Debugging Logs (Optional, remove in production) ---
        console.log("League ID selected:", league);
        console.log("Team 1 ID:", t1, "Team 2 ID:", t2);
        console.log("Full Standings Data (raw):", stand);
        console.log("Head-to-Head Data (raw):", h2h);
        console.log("Form Team 1 (raw):", form1);
        console.log("Form Team 2 (raw):", form2);
        console.log("Team 1 Standings Found:", !!a); // !!a converts to boolean
        console.log("Team 2 Standings Found:", !!b);
        // --- End Debugging Logs ---


        out.innerHTML = ''; // Clear previous output before displaying new results

        // Check if both teams' standings data were successfully found
        if (a && b) {
            // Fetch and Process Match Statistics for the most recent H2H match
            let matchStatistics = [];
            if (h2h && h2h.length > 0) {
                // API-Sports usually returns H2H fixtures chronologically, most recent first.
                // We'll take the first one (index 0) to get its statistics.
                const mostRecentFixtureId = h2h[0].fixture.id;
                console.log(`Fetching statistics for most recent H2H fixture: ${mostRecentFixtureId}`);
                matchStatistics = await fetchMatchStatistics(mostRecentFixtureId);
                console.log("Match Statistics (raw):", matchStatistics);
            } else {
                console.log("No head-to-head matches found, skipping detailed statistics fetch.");
            }

            // Build the H2H matches list HTML
            const h2hListHtml = h2h.length > 0 ?
                `<ul>${h2h.map(f => `<li>${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} (${new Date(f.fixture.date).toLocaleDateString()})</li>`).join('')}</ul>` :
                '<p>No head-to-head matches found.</p>';

            // Build the Match Statistics HTML section
            let statsHtml = '';
            // Ensure there are statistics and at least one H2H match to reference h2h[0]
            if (matchStatistics.length > 0 && h2h.length > 0) {
                const fixtureHomeTeamName = h2h[0].teams.home.name;
                const fixtureAwayTeamName = h2h[0].teams.away.name;

                // Pass the matchStatistics to generatePrediction
                statsHtml = `
                    <h2>Most Recent H2H Match Statistics</h2>
                    <p>Match: ${fixtureHomeTeamName} ${h2h[0].goals.home}-${h2h[0].goals.away} ${fixtureAwayTeamName} on ${new Date(h2h[0].fixture.date).toLocaleDateString()}</p>
                    <div class="match-stats-grid">
                      <div class="team-stats-column">
                        <h3>${fixtureHomeTeamName}</h3>
                        <ul>
                          ${matchStatistics.find(s => s.team.id === h2h[0].teams.home.id) && matchStatistics.find(s => s.team.id === h2h[0].teams.home.id).statistics
                            ? matchStatistics.find(s => s.team.id === h2h[0].teams.home.id).statistics.map(s => `<li><strong>${s.type}:</strong> ${s.value !== null ? s.value : 'N/A'}</li>`).join('')
                            : '<li>No detailed stats available.</li>'}
                        </ul>
                      </div>
                      <div class="team-stats-column">
                        <h3>${fixtureAwayTeamName}</h3>
                        <ul>
                          ${matchStatistics.find(s => s.team.id === h2h[0].teams.away.id) && matchStatistics.find(s => s.team.id === h2h[0].teams.away.id).statistics
                            ? matchStatistics.find(s => s.team.id === h2h[0].teams.away.id).statistics.map(s => `<li><strong>${s.type}:</strong> ${s.value !== null ? s.value : 'N/A'}</li>`).join('')
                            : '<li>No detailed stats available.</li>'}
                        </ul>
                      </div>
                    </div>
                `;
            } else {
                statsHtml = '<p>No detailed statistics available for the most recent head-to-head match.</p>';
            }

            // Generate Prediction using all collected data
            const predictionHtml = generatePrediction(a.team.name, b.team.name, a.points, b.points, form1, form2, h2h, matchStatistics);

            // Construct the final output HTML
            out.innerHTML = `
                <h2>Standings</h2>
                <p><img src="${a.team.logo}" width="30"> ${a.team.name}: ${a.rank} (${a.points} pts)</p>
                <p><img src="${b.team.logo}" width="30"> ${b.team.name}: ${b.rank} (${b.points} pts)</p>

                <h2>H2H Matches</h2>
                ${h2hListHtml}

                ${statsHtml}

                <div class="prediction-section">
                  <h2>Match Prediction</h2>
                  ${predictionHtml}
                </div>
            `;
            drawCharts(form1, form2, a.points, b.points); // Draw charts after all data is ready
        } else {
            // Error message if standing data is missing for one or both teams
            out.innerHTML = `
                <h2>Comparison Results</h2>
                <p>Could not perform a full comparison because standings data for one or both teams could not be found for the selected league and season (${SEASON_TO_FETCH}).</p>
                <p>Please ensure you have selected valid teams and that data is available for the current season (check your API plan for recent seasons like ${SEASON_TO_FETCH}).</p>
            `;
            // Destroy charts if data is incomplete
            if (formChartInstance) formChartInstance.destroy();
            if (pointsChartInstance) pointsChartInstance.destroy();
        }

    } catch (error) {
        // General error handling for any issues during the comparison process
        console.error("Error during comparison:", error);
        out.innerHTML = `
            <h2>Comparison Error</h2>
            <p>An unexpected error occurred while fetching data for comparison. Please try again.</p>
            <p>Details: ${error.message}. Please verify your API key and network connection.</p>
        `;
        // Destroy charts on critical error
        if (formChartInstance) formChartInstance.destroy();
        if (pointsChartInstance) pointsChartInstance.destroy();
    }
}

// Initial call to populate the league dropdown when the page loads
initialLoad();