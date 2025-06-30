// Global variables for Chart.js instances to allow their destruction and re-creation
let formChartInstance = null;
let pointsChartInstance = null;

// Your API Key and Base URL for the API-Sports Football API
const API_KEY = 'a0a2237e06c074bb980edb3e952c44d7'; // IMPORTANT: Replace with your actual API key
const BASE = 'https://v3.football.api-sports.io';
const headers = { 'x-apisports-key': API_KEY };

// --- API Fetch Functions ---

/**
 * Fetches a list of all available leagues from the API.
 * @returns {Array} An array of league objects, potentially nested.
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
            // Relaxed filter: only check for valid league.id
            const filteredLeagues = data.response.filter(l => l.league && l.league.id !== null);

            console.log("Filtered leagues (l.league.id != null):", filteredLeagues);
            console.log("Number of filtered leagues:", filteredLeagues.length);

            if (filteredLeagues.length === 0) {
                console.warn("No leagues found after applying filter (l.league.id is null).");
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
 * Fetches teams for a specific league and season.
 * @param {string} leagueId - The ID of the league.
 * @param {string} season - The year of the season.
 * @returns {Array} An array of team objects.
 */
async function fetchTeams(leagueId, season) {
    try {
        console.log(`Fetching teams for league: ${leagueId}, season: ${season}`);
        const res = await fetch(`${BASE}/teams?league=${leagueId}&season=${season}`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching teams (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const data = await res.json();
        if (data.response && data.response.length > 0) {
            return data.response.map(t => ({ id: t.team.id, name: t.team.name, logo: t.team.logo }));
        } else {
            console.warn(`No teams found for league ${leagueId} in season ${season}. Check your API plan or season ID.`);
            return [];
        }
    } catch (error) {
        console.error("Error in fetchTeams:", error);
        throw error;
    }
}

/**
 * Fetches standings for a specific league and season.
 * @param {string} leagueId - The ID of the league.
 * @param {string} season - The year of the season.
 * @returns {Array} An array of standing entry objects.
 */
async function fetchStandings(leagueId, season) {
    try {
        console.log(`Fetching standings for league: ${leagueId}, season: ${season}`);
        const res = await fetch(`${BASE}/standings?league=${leagueId}&season=${season}`, { headers });
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
            console.warn(`No standings found for league ${leagueId} in season ${season}. Check your API plan or season ID.`);
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
 * @returns {Array} An array of recent fixture objects.
 */
async function fetchForm(teamId) {
    try {
        // We'll fetch the last 10 matches to give a more comprehensive view,
        // but you can adjust 'last=5' to any number you prefer.
        const res = await fetch(`${BASE}/fixtures?team=${teamId}&last=10`, { headers });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`API error fetching team form (${res.status} ${res.statusText}): ${errorBody.substring(0, 200)}`);
        }
        const json = await res.json();
        if (json.response) {
            // Return the raw response fixtures. We'll process them in compare()
            return json.response;
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
 * Populates the initial league and season dropdowns when the page loads.
 */
async function initialLoad() {
    const leagueSelect = document.getElementById('league');
    const seasonSelect = document.getElementById('season'); // Get the new season select element

    leagueSelect.innerHTML = '<option value="">Cargando Ligas...</option>'; // Placeholder while loading
    seasonSelect.innerHTML = '<option value="">Cargando Temporadas...</option>'; // Placeholder for seasons

    try {
        let allLeagues = await fetchAllLeagues();
        leagueSelect.innerHTML = '<option value="">Selcciona una Liga</option>'; // Reset with default option

        // Sort the leagues alphabetically by name
        allLeagues.sort((a, b) => {
            const nameA = a.league.name ?? 'Unnamed League';
            const nameB = b.league.name ?? 'Unnamed League';
            return nameA.localeCompare(nameB);
        });

        const availableSeasons = new Set();
        let latestCurrentSeason = null; // To find the most recent 'current: true' season

        allLeagues.forEach(l => {
            const leagueId = l.league.id;
            const leagueName = l.league.name ?? 'Unnamed League';
            // Robust country name fallback: check if l.country exists first
            const countryName = l.country ? (l.country.name ?? 'Unknown Country') : 'Unknown Country';

            // Add the option to the league dropdown
            const option = new Option(`${leagueName} (${countryName})`, leagueId);
            leagueSelect.add(option);

            // Collect seasons for the season dropdown
            l.seasons.forEach(s => {
                // Ensure the season is within a reasonable range (e.g., 2010 to current year + 1)
                // Adjust this range based on your API plan's coverage if needed.
                if (s.year >= 2010 && s.year <= (new Date().getFullYear() + 1)) {
                    availableSeasons.add(s.year);
                }
                // Track the latest 'current' season to set as default
                if (s.current) {
                    if (latestCurrentSeason === null || s.year > latestCurrentSeason) {
                        latestCurrentSeason = s.year;
                    }
                }
            });
        });

        // Populate and sort the season dropdown
        const sortedSeasons = Array.from(availableSeasons).sort((a, b) => b - a); // Sort descending (newest first)
        seasonSelect.innerHTML = '<option value="">Select a Season</option>'; // Reset
        sortedSeasons.forEach(year => {
            seasonSelect.add(new Option(year, year));
        });

        // Set default selected season (prioritize latest 'current' season, then current year, then latest available)
        let defaultSeason = null;
        const currentYear = new Date().getFullYear();

        if (latestCurrentSeason && sortedSeasons.includes(latestCurrentSeason)) {
            defaultSeason = latestCurrentSeason;
        } else if (sortedSeasons.includes(currentYear)) {
            defaultSeason = currentYear;
        } else if (sortedSeasons.length > 0) {
            defaultSeason = sortedSeasons[0]; // Fallback to the latest available season
        }

        if (defaultSeason) {
            seasonSelect.value = defaultSeason;
        }


        // Optionally, auto-select a default league and load its teams after populating
        // Example: Select Premier League (ID 39) if available.
        // Check if there's a selected league and season before trying to load teams
        const defaultLeagueId = '39'; // Premier League ID
        const premierLeagueAvailable = allLeagues.some(l => l.league.id == defaultLeagueId);

        if (premierLeagueAvailable && defaultSeason) {
             leagueSelect.value = defaultLeagueId;
             await loadTeams(); // Load teams for the pre-selected league and default season
        } else if (defaultSeason && allLeagues.length > 0) {
            // If Premier League isn't available, but we have leagues and a default season,
            // select the first available league and load teams.
            leagueSelect.value = allLeagues[0].league.id;
            await loadTeams();
        }


    } catch (error) {
        console.error("Error loading leagues and seasons:", error);
        leagueSelect.innerHTML = '<option value="">Failed to load leagues</option>';
        seasonSelect.innerHTML = '<option value="">Failed to load seasons</option>';
        alert("Failed to load leagues and seasons. Check your API key and internet connection.");
    }
}


/**
 * Loads teams for the currently selected league and season and populates the team dropdowns.
 */
async function loadTeams() {
    const league = document.getElementById('league').value;
    const season = document.getElementById('season').value; // Get selected season

    const team1Select = document.getElementById('team1');
    const team2Select = document.getElementById('team2');

    // Clear previous teams
    team1Select.innerHTML = '<option value="">Select Team</option>';
    team2Select.innerHTML = '<option value="">Select Team</option>';

    // Clear charts and output if conditions aren't met
    if (formChartInstance) formChartInstance.destroy();
    if (pointsChartInstance) pointsChartInstance.destroy();
    document.getElementById('output').innerHTML = `
        <h2>Comparativa de dos equipos</h2>
        <p>Selecciona ana liga, una temporada, y dos equipospara compararlos, ver partidos recientes, y sus estadisticas!</p>
    `;


    if (!league || !season) {
        console.log("League or Season not selected. Not loading teams.");
        return; // Exit if no league or season is selected
    }

    console.log("Loading teams for league:", league, "and season:", season);

    try {
        const teams = await fetchTeams(league, season); // Pass season to fetchTeams
        console.log("Teams received:", teams);

        if (teams.length > 0) {
            teams.forEach(t => {
                team1Select.add(new Option(t.name, t.id));
                team2Select.add(new Option(t.name, t.id));
            });
        } else {
            console.warn(`No teams found for league ${league} in season ${season}.`);
            // Add a message to the team dropdowns if no teams are found
            team1Select.innerHTML = '<option value="">No Teams Found</option>';
            team2Select.innerHTML = '<option value="">No Teams Found</option>';
        }
    } catch (error) {
        console.error("Error loading teams:", error);
        alert("Failed to load teams for the selected league and season. Data might not be available or your API key is invalid.");
        team1Select.innerHTML = '<option value="">Error Loading Teams</option>';
        team2Select.innerHTML = '<option value="">Error Loading Teams</option>';
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
 * @param {Array} h2hMatches - Head-to-head match history (full list for H2H record analysis).
 * @param {Array} matchStatistics - Detailed statistics of the *most recent available* H2H match.
 * @param {Object} mostRecentH2HFixtureObject - The *fixture object* for the match whose statistics are provided.
 * @returns {string} HTML string containing the prediction.
 */
function generatePrediction(team1Name, team2Name, pts1, pts2, form1, form2, h2hMatches, matchStatistics, mostRecentH2HFixtureObject) {
    let predictionText = "";
    let team1Advantage = 0;
    let team2Advantage = 0;

    // Helper to safely get stat value (ensure this function is exactly as in Step 1)
    const getStatValue = (statsArray, type) => {
        const stat = statsArray ? statsArray.find(s => s.type === type) : null;
        if (stat && stat.value !== null) {
            const rawValue = String(stat.value).replace('%', '');
            const parsedValue = parseFloat(rawValue);
            if (!isNaN(parsedValue)) {
                return parsedValue;
            }
        }
        return 'N/A';
    };

    // --- 1. Analyze League Points ---
    const pointsDiff = Math.abs(pts1 - pts2);
    if (pointsDiff > 10) { // Arbitrary threshold for significant point difference
        if (pts1 > pts2) {
            predictionText += `${team1Name} tiene una ventaja significativa en puntos de liga. `;
            team1Advantage += 2;
        } else {
            predictionText += `${team2Name} tiene una ventaja significativa en puntos de liga. `;
            team2Advantage += 2;
        }
    } else if (pointsDiff > 3) { // Smaller but noticeable difference
        if (pts1 > pts2) {
            predictionText += `${team1Name} tiene una ligera ventaja en puntos de liga. `;
            team1Advantage += 1;
        } else {
            predictionText += `${team2Name} tiene una ligera ventaja en puntos de liga. `;
            team2Advantage += 1;
        }
    } else {
        predictionText += `Ambos equipos están muy igualados en puntos de liga. `;
    }

    // --- 2. Analyze Recent Form (Wins in last 5 games) ---
    const form1Wins = form1.filter(f => f.outcome === 'W').length;
    const form2Wins = form2.filter(f => f.outcome === 'W').length;
    const formDiff = Math.abs(form1Wins - form2Wins);

    if (formDiff >= 2) { // Arbitrary threshold for significant form difference
        if (form1Wins > form2Wins) {
            predictionText += `${team1Name} llega a este partido con mejor forma reciente (más victorias en los últimos 5 partidos). `;
            team1Advantage += 1.5;
        } else {
            predictionText += `${team2Name} llega a este partido con mejor forma reciente (más victorias en los últimos 5 partidos). `;
            team2Advantage += 1.5;
        }
    } else if (formDiff === 1) {
        if (form1Wins > form2Wins) {
            predictionText += `${team1Name} tiene una forma reciente ligeramente mejor. `;
            team1Advantage += 0.5;
        } else {
            predictionText += `${team2Name} tiene una forma reciente ligeramente mejor. `;
            team2Advantage += 0.5;
        }
    } else {
        predictionText += `Sus formas recientes son bastante similares. `;
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
        predictionText += `En ${totalH2H} encuentros directos anteriores: ${team1Name} ganó ${h2hTeam1Wins}, ${team2Name} ganó ${h2hTeam2Wins}, y hubo ${h2hDraws} empates. `;

        if (h2hTeam1Wins > h2hTeam2Wins + 2) { // Arbitrary threshold for H2H dominance
            predictionText += `${team1Name} domina históricamente este encuentro. `;
            team1Advantage += 1;
        } else if (h2hTeam2Wins > h2hTeam1Wins + 2) {
            predictionText += `${team2Name} domina históricamente este encuentro. `;
            team2Advantage += 1;
        }
    } else {
        predictionText += `No hay un historial significativo de encuentros directos a considerar. `;
    }

    // --- Insights from Most Recent H2H Match Statistics (if available) ---
    let detailedPredictionHtml = '';
    // Use mostRecentH2HFixtureObject to get the correct match details for the statistics
    if (matchStatistics && matchStatistics.length > 0 && mostRecentH2HFixtureObject) {
        const team1Id = Number(document.getElementById('team1').value);
        const team2Id = Number(document.getElementById('team2').value);

        const team1Stats = matchStatistics.find(s => s.team.id === team1Id);
        const team2Stats = matchStatistics.find(s => s.team.id === team2Id);

        let totalGoals = 0; // Initialize with 0
        let totalShotsOnGoal = 'N/A';
        let totalCorners = 'N/A';
        let totalFouls = 'N/A';
        let totalPenalties = 0; // Initialize with 0

        // --- FIX FOR TOTAL GOALS: Directly use goals from the fixture object ---
        if (mostRecentH2HFixtureObject.goals &&
            typeof mostRecentH2HFixtureObject.goals.home === 'number' &&
            typeof mostRecentH2HFixtureObject.goals.away === 'number') {
            totalGoals = mostRecentH2HFixtureObject.goals.home + mostRecentH2HFixtureObject.goals.away;
        } else {
            totalGoals = 'N/A'; // Fallback if goal data is malformed or missing
        }

        // Check if both teams have stats before summing other general stats
        if (team1Stats && team2Stats) {
            const shots1 = getStatValue(team1Stats.statistics, 'Shots on Goal');
            const shots2 = getStatValue(team2Stats.statistics, 'Shots on Goal');
            if (shots1 !== 'N/A' && shots2 !== 'N/A') totalShotsOnGoal = shots1 + shots2;

            const corners1 = getStatValue(team1Stats.statistics, 'Corner Kicks');
            const corners2 = getStatValue(team2Stats.statistics, 'Corner Kicks');
            if (corners1 !== 'N/A' && corners2 !== 'N/A') totalCorners = corners1 + corners2;

            const fouls1 = getStatValue(team1Stats.statistics, 'Fouls');
            const fouls2 = getStatValue(team2Stats.statistics, 'Fouls');
            if (fouls1 !== 'N/A' && fouls2 !== 'N/A') totalFouls = fouls1 + fouls2;

            // --- FIX FOR PENALTIES: Default to 0 if not found ---
            const penalties1 = getStatValue(team1Stats.statistics, 'Penalties');
            const penalties2 = getStatValue(team2Stats.statistics, 'Penalties');

            let sumPenalties = 0;
            if (penalties1 !== 'N/A') {
                sumPenalties += penalties1;
            }
            if (penalties2 !== 'N/A') {
                sumPenalties += penalties2;
            }
            totalPenalties = sumPenalties; // This will be 0 if both were 'N/A'
        }

        detailedPredictionHtml = `
            <h4>Retrospectiva:</h4>
            <ul>
                <li>Goles Totales: ${totalGoals}</li>
                <li>Tiros a Puerta Totales: ${totalShotsOnGoal}</li>
                <li>Saques de Esquina: ${totalCorners}</li>
                <li>Faltas Cometidas: ${totalFouls}</li>
                <li>Penalties: ${totalPenalties}</li>
            </ul>
            <p>Basado en su encuentro directo más reciente con estadísticas disponibles, podríamos observar un patrón similar en oportunidades de gol, jugadas a balón parado y fisicalidad en su próximo partido.</p>
        `;
    } else {
        detailedPredictionHtml = "<p>No hay estadísticas detalladas del partido disponibles de encuentros directos pasados para proporcionar más información sobre eventos específicos del partido.</p>";
    }

    // --- Final Combined Prediction ---
    let finalOutcome = "";
    if (team1Advantage > team2Advantage + 1) { // Team 1 has a clear advantage
        finalOutcome = `${team1Name} es favorito para ganar este partido.`;
    } else if (team2Advantage > team1Advantage + 1) { // Team 2 has a clear advantage
        finalOutcome = `${team2Name} es favorito para ganar este partido.`;
    } else if (team1Advantage > 0.5 || team2Advantage > 0.5) { // One team has a slight edge overall
        finalOutcome = `${team1Advantage > team2Advantage ? team1Name : team2Name} tiene una ligera ventaja, pero podría ser un partido reñido.`;
    } else { // Very evenly matched
        finalOutcome = `Este parece un partido muy igualado, un empate es una fuerte posibilidad.`;
    }

    return `
        <p><strong>Basado en toda la información:</strong> ${predictionText}</p>
        ${detailedPredictionHtml}
        <h3>Predicción: ${finalOutcome}</h3>
        <p class="disclaimer"><em>(Descargo de responsabilidad: ¡La información proporcionada no es un dato exacto, los partidos pueden ser impredecibles!)</em></p>
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
    const season = document.getElementById('season').value; // Get selected season

    const out = document.getElementById('output');

    // Basic input validation: ensure all inputs are selected
    if (!league || !t1 || !t2 || !season) {
        out.innerHTML = `
            <h2>Error de Comparativa</h2>
            <p>Please select a League, a Season, Team 1, and Team 2 to perform a comparison.</p>
        `;
        if (formChartInstance) formChartInstance.destroy();
        if (pointsChartInstance) pointsChartInstance.destroy();
        return;
    }

    try {
        // Fetch all necessary data concurrently using Promise.all
        const [stand, h2hRaw, form1Raw, form2Raw] = await Promise.all([ // Renamed form1/2 to form1Raw/form2Raw
            fetchStandings(league, season),
            fetchH2H(t1, t2),
            fetchForm(t1), // This now returns full fixture objects
            fetchForm(t2), // This now returns full fixture objects
        ]);

        const a = stand.find(r => r.team.id === Number(t1));
        const b = stand.find(r => r.team.id === Number(t2));

        console.log("League ID selected:", league);
        console.log("Season selected:", season);
        console.log("Team 1 ID:", t1, "Team 2 ID:", t2);
        console.log("Full Standings Data (raw):", stand);
        console.log("Head-to-Head Data (raw):", h2hRaw);
        console.log("Form Team 1 (raw - full fixtures):", form1Raw); // Log raw fixtures
        console.log("Form Team 2 (raw - full fixtures):", form2Raw); // Log raw fixtures
        console.log("Team 1 Standings Found:", !!a);
        console.log("Team 2 Standings Found:", !!b);


        out.innerHTML = ''; // Clear previous output before displaying new results

        let matchStatistics = [];
        let mostRecentH2HFixtureWithStats = null; // Variable to store the fixture that actually has stats

        if (h2hRaw && h2hRaw.length > 0) {
            // Iterate through H2H matches to find the first one that has statistics.
            for (const fixture of h2hRaw) {
                const currentFixtureId = fixture.fixture.id;
                console.log(`Checking fixture ID ${currentFixtureId} (Date: ${new Date(fixture.fixture.date).toLocaleDateString()}) for statistics...`);
                
                const stats = await fetchMatchStatistics(currentFixtureId); // Attempt to fetch stats for this fixture

                if (stats && stats.length > 0) {
                    // Found a fixture with statistics!
                    mostRecentH2HFixtureWithStats = fixture; // Store the fixture object
                    matchStatistics = stats; // Store its statistics
                    console.log(`SUCCESS: Found statistics for fixture ID: ${currentFixtureId}. Date: ${new Date(fixture.fixture.date).toLocaleDateString()}`);
                    break; // Stop at the first (most recent) match that has stats
                } else {
                    console.log(`No statistics found for fixture ID ${currentFixtureId}. Trying older match...`);
                }
            }
        } else {
            console.log("No head-to-head matches found.");
        }

        // Now, create a *copy* of h2hRaw and sort it for display purposes (oldest first)
        const h2hForDisplay = [...h2hRaw]; // Create a shallow copy
        h2hForDisplay.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));


        if (a && b) {
            // Helper function to render a team's recent matches for display
            const renderRecentMatches = (teamName, teamId, recentFixtures) => {
                if (!recentFixtures || recentFixtures.length === 0) {
                    return `<p>No recent matches found for ${teamName}.</p>`;
                }

                const matchesHtml = recentFixtures.map(f => {
                    const isHome = f.teams.home.id === Number(teamId);
                    const opponentName = isHome ? f.teams.away.name : f.teams.home.name;
                    const teamGoals = isHome ? f.goals.home : f.goals.away;
                    const opponentGoals = isHome ? f.goals.away : f.goals.home;
                    const matchDate = new Date(f.fixture.date).toLocaleDateString();
                    const resultClass = teamGoals > opponentGoals ? 'result-win' : (teamGoals < opponentGoals ? 'result-loss' : 'result-draw');
                    const location = isHome ? '(H)' : '(A)';

                    return `
                        <div class="recent-match-item ${resultClass}">
                            <span class="match-date">${matchDate}</span>
                            <span class="match-details">${location} vs ${opponentName}</span>
                            <span class="match-score">${teamGoals}-${opponentGoals}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <h3>${teamName} Recent Matches</h3>
                    <div class="recent-matches-container">
                        ${matchesHtml}
                    </div>
                `;
            };

            // Generate HTML for recent matches
            const team1RecentMatchesHtml = renderRecentMatches(a.team.name, t1, form1Raw);
            const team2RecentMatchesHtml = renderRecentMatches(b.team.name, t2, form2Raw);

            // Extract simplified form (W/D/L) for the chart and prediction function
            // This is crucial because generatePrediction and drawCharts expect this simpler format
            const form1ForChartAndPrediction = form1Raw.map(f => ({
                outcome: f.teams.home.id === Number(t1)
                    ? (f.goals.home > f.goals.away ? 'W' : f.goals.home < f.goals.away ? 'L' : 'D')
                    : (f.goals.away > f.goals.home ? 'W' : f.goals.away < f.goals.home ? 'L' : 'D')
            }));
            const form2ForChartAndPrediction = form2Raw.map(f => ({
                outcome: f.teams.home.id === Number(t2)
                    ? (f.goals.home > f.goals.away ? 'W' : f.goals.home < f.goals.away ? 'L' : 'D')
                    : (f.goals.away > f.goals.home ? 'W' : f.goals.away < f.goals.home ? 'L' : 'D')
            }));

            const h2hListHtml = h2hForDisplay.length > 0 ?
                `<div class="h2h-grid">${h2hForDisplay.map(f => `
                    <div class="h2h-item">
                        ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name}
                        <span class="h2h-date">(${new Date(f.fixture.date).toLocaleDateString()})</span>
                    </div>
                `).join('')}</div>` :
                '<p>No head-to-head matches found.</p>';

            let statsHtml = '';
            // Ensure both matchStatistics has data AND mostRecentH2HFixtureWithStats is a valid object
            if (matchStatistics.length > 0 && mostRecentH2HFixtureWithStats) {
                const fixtureHomeTeamName = mostRecentH2HFixtureWithStats.teams.home.name;
                const fixtureAwayTeamName = mostRecentH2HFixtureWithStats.teams.away.name;

                statsHtml = `
                    <h2>Estadística del partido más reciente(Con información)</h2>
                    <p>Partido: ${fixtureHomeTeamName} ${mostRecentH2HFixtureWithStats.goals.home}-${mostRecentH2HFixtureWithStats.goals.away} ${fixtureAwayTeamName} on ${new Date(mostRecentH2HFixtureWithStats.fixture.date).toLocaleDateString()}</p>
                    <div class="match-stats-grid">
                      <div class="team-stats-column">
                        <h3>${fixtureHomeTeamName}</h3>
                        <ul>
                          ${matchStatistics.find(s => s.team.id === mostRecentH2HFixtureWithStats.teams.home.id) && matchStatistics.find(s => s.team.id === mostRecentH2HFixtureWithStats.teams.home.id).statistics
                            ? matchStatistics.find(s => s.team.id === mostRecentH2HFixtureWithStats.teams.home.id).statistics.map(s => `<li><strong>${s.type}:</strong> ${s.value !== null ? s.value : 'N/A'}</li>`).join('')
                            : '<li>No detailed stats available for this team.</li>'}
                        </ul>
                      </div>
                      <div class="team-stats-column">
                        <h3>${fixtureAwayTeamName}</h3>
                        <ul>
                          ${matchStatistics.find(s => s.team.id === mostRecentH2HFixtureWithStats.teams.away.id) && matchStatistics.find(s => s.team.id === mostRecentH2HFixtureWithStats.teams.away.id).statistics
                            ? matchStatistics.find(s => s.team.id === mostRecentH2HFixtureWithStats.teams.away.id).statistics.map(s => `<li><strong>${s.type}:</strong> ${s.value !== null ? s.value : 'N/A'}</li>`).join('')
                            : '<li>No detailed stats available for this team.</li>'}
                        </ul>
                      </div>
                    </div>
                `;
            } else {
                statsHtml = '<p>No detailed statistics found for any head-to-head matches between these teams. This could be because statistics are not provided by the API for these specific fixtures (e.g., very old, future, or lower-tier matches), or there was an issue fetching them.</p>';
            }

            // Pass the *converted* form data to generatePrediction
            const predictionHtml = generatePrediction(a.team.name, b.team.name, a.points, b.points, form1ForChartAndPrediction, form2ForChartAndPrediction, h2hForDisplay, matchStatistics, mostRecentH2HFixtureWithStats);

            out.innerHTML = `
                <h2>Posición</h2>
                <p><img src="${a.team.logo}" width="30"> ${a.team.name}: ${a.rank} (${a.points} pts)</p>
                <p><img src="${b.team.logo}" width="30"> ${b.team.name}: ${b.rank} (${b.points} pts)</p>

                <div class="recent-performance-section">
                    <h2>Partidos Recientes</h2>
                    <div class="recent-performance-grid">
                        <div class="team-recent-matches">
                            ${team1RecentMatchesHtml}
                        </div>
                        <div class="team-recent-matches">
                            ${team2RecentMatchesHtml}
                        </div>
                    </div>
                </div>

                <h2>Partidos</h2>
                ${h2hListHtml}

                ${statsHtml}

                <div class="prediction-section">
                  <h2>Predicción del partido</h2>
                  ${predictionHtml}
                </div>
            `;
            // Pass the *converted* form data to drawCharts
            drawCharts(form1ForChartAndPrediction, form2ForChartAndPrediction, a.points, b.points);
        } else {
            out.innerHTML = `
                <h2>Comparar Resultados</h2>
                <p>Could not perform a full comparison because standings data for one or both teams could not be found for the selected league and season (${season}).</p>
                <p>Please ensure you have selected valid teams and that data is available for the current season/your API key plan.</p>
            `;
            if (formChartInstance) formChartInstance.destroy();
            if (pointsChartInstance) pointsChartInstance.destroy();
        }

    } catch (error) {
        console.error("Error during comparison:", error);
        out.innerHTML = `
            <h2>Error de Comparación</h2>
            <p>An unexpected error occurred while fetching data for comparison. Please try again.</p>
            <p>Details: ${error.message}. Please verify your API key and network connection.</p>
        `;
        if (formChartInstance) formChartInstance.destroy();
        if (pointsChartInstance) pointsChartInstance.destroy();
    }
}

// Initial call to populate the league and season dropdowns when the page loads
initialLoad();
