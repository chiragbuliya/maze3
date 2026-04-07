document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const gridEl = document.getElementById('grid');
    const rowsInput = document.getElementById('rows-input');
    const colsInput = document.getElementById('cols-input');
    const generateBtn = document.getElementById('generate-btn');
    const clearGridBtn = document.getElementById('clear-grid-btn');
    const algoSelect = document.getElementById('algo-select');
    const depthContainer = document.getElementById('depth-limit-container');
    const depthInput = document.getElementById('depth-input');
    const runBtn = document.getElementById('run-btn');
    const clearPathBtn = document.getElementById('clear-path-btn');
    const formatRadios = document.querySelectorAll('input[name="mode"]');

    // Results
    const resultsPanel = document.getElementById('results-panel');
    const resAlgo = document.getElementById('res-algo');
    const resStatus = document.getElementById('res-status');
    const resVisited = document.getElementById('res-visited');
    const resLength = document.getElementById('res-length');

    const logPanel = document.getElementById('log-panel');
    const executionLog = document.getElementById('execution-log');

    const viewGraphBtn = document.getElementById('view-graph-btn');

    let graphWindow = null;
    let graphWindowReady = false;
    let pendingGraphMessages = [];

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ready') {
            graphWindowReady = true;
            for (let msg of pendingGraphMessages) {
                if (graphWindow && !graphWindow.closed) {
                    graphWindow.postMessage(msg, '*');
                }
            }
            pendingGraphMessages = [];
        }
    });

    function openGraphTab() {
        if (!graphWindow || graphWindow.closed) {
            graphWindowReady = false;
            graphWindow = window.open('graph.html', 'MazeGraphWindow');
        } else {
            graphWindow.focus();
        }
    }

    if (viewGraphBtn) viewGraphBtn.addEventListener('click', openGraphTab);

    let stepCounter = 1;

    function logStep(text) {
        if (!executionLog) return;
        const li = document.createElement('li');
        li.textContent = text;
        executionLog.appendChild(li);
        if (logPanel) logPanel.scrollTop = logPanel.scrollHeight;
    }

    function sendToGraph(msg) {
        if (!graphWindow || graphWindow.closed) return;
        if (graphWindowReady) {
            graphWindow.postMessage(msg, '*');
        } else {
            pendingGraphMessages.push(msg);
        }
    }

    function addGraphNode(id, parentId, labelText, r, c) {
        sendToGraph({ type: 'node', id, parentId, labelText, r, c });
    }

    function addGraphNode(id, parentId, labelText, r, c, isStart = false, isGoal = false) {
        sendToGraph({ type: 'node', id, parentId, labelText, r, c, isStart, isGoal });
    }

    function setCellText(r, c, text) {
        const cell = document.getElementById(`cell-${r}-${c}`);
        if (cell) cell.textContent = text;
    }

    function initLogs() {
        stepCounter = 1;
        if (executionLog) executionLog.innerHTML = '';
        if (logPanel) logPanel.classList.remove('hidden');
        openGraphTab();
        sendToGraph({ type: 'clear' });
    }

    // --- State ---
    let rows = 15;
    let cols = 20;
    let gridData = [];
    let startNode = { r: 1, c: 1 };
    let goalNode = { r: 13, c: 18 };
    let isDrawing = false;
    let drawMode = 'wall';
    let isRunning = false;
    let animSpeed = 20; // ms

    // --- Init ---
    initGrid();

    // --- Evt Listeners ---
    generateBtn.addEventListener('click', () => {
        if (isRunning) return;
        let rVal = parseInt(rowsInput.value) || 15;
        let cVal = parseInt(colsInput.value) || 20;
        rows = Math.max(5, Math.min(40, rVal));
        cols = Math.max(5, Math.min(40, cVal));
        rowsInput.value = rows;
        colsInput.value = cols;
        startNode = { r: 1, c: 1 };
        goalNode = { r: rows - 2, c: cols - 2 };
        if (goalNode.r < 0) goalNode.r = 0;
        if (goalNode.c < 0) goalNode.c = 0;
        initGrid();
    });

    clearGridBtn.addEventListener('click', () => {
        if (isRunning) return;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gridData[r][c] === 'wall' || gridData[r][c] === 'visited' || gridData[r][c] === 'path') {
                    gridData[r][c] = 'empty';
                }
                const cell = document.getElementById(`cell-${r}-${c}`);
                if (cell) cell.textContent = '';
            }
        }
        renderGrid();
        hideResults();
        if (executionLog) executionLog.innerHTML = '';
        if (logPanel) logPanel.classList.add('hidden');
    });

    clearPathBtn.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false; // allow stopping
            return;
        }
        clearVisualization();
        hideResults();
        if (executionLog) executionLog.innerHTML = '';
        if (logPanel) logPanel.classList.add('hidden');
    });

    algoSelect.addEventListener('change', () => {
        if (algoSelect.value === 'dls') {
            depthContainer.classList.remove('hidden');
        } else {
            depthContainer.classList.add('hidden');
        }
    });

    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            drawMode = e.target.value;
            document.querySelectorAll('.radio-label').forEach(lbl => lbl.classList.remove('active'));
            e.target.parentElement.classList.add('active');
        });
    });

    // Painting handlers
    gridEl.addEventListener('mousedown', (e) => {
        if (isRunning) return;
        isDrawing = true;
        handleCellInteraction(e.target);
        e.preventDefault(); // prevent drag
    });

    gridEl.addEventListener('mouseover', (e) => {
        if (isRunning) return;
        if (isDrawing) {
            handleCellInteraction(e.target);
        }
    });

    document.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    runBtn.addEventListener('click', runAlgorithm);


    // --- Core Funcs ---
    function initGrid() {
        gridData = [];
        for (let r = 0; r < rows; r++) {
            let row = [];
            for (let c = 0; c < cols; c++) {
                if (r === startNode.r && c === startNode.c) row.push('start');
                else if (r === goalNode.r && c === goalNode.c) row.push('goal');
                else row.push('empty');
            }
            gridData.push(row);
        }

        setupDOMGrid();
        renderGrid();
        hideResults();
    }

    function setupDOMGrid() {
        gridEl.innerHTML = '';
        gridEl.style.setProperty('--cols', cols);
        gridEl.style.setProperty('--rows', rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.id = `cell-${r}-${c}`;
                cell.textContent = '';
                gridEl.appendChild(cell);
            }
        }
    }

    function renderGrid() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.getElementById(`cell-${r}-${c}`);
                cell.className = 'cell'; // reset
                if (gridData[r][c] !== 'empty') {
                    cell.classList.add(gridData[r][c]);
                }
            }
        }
    }

    function updateCellVisual(r, c, type) {
        if (r === startNode.r && c === startNode.c) return;
        if (r === goalNode.r && c === goalNode.c) return;
        const cell = document.getElementById(`cell-${r}-${c}`);
        cell.className = 'cell'; // remove others
        cell.classList.add(type);
    }

    function handleCellInteraction(target) {
        if (!target.classList.contains('cell')) return;

        const r = parseInt(target.dataset.r);
        const c = parseInt(target.dataset.c);

        if (r === startNode.r && c === startNode.c && drawMode !== 'start') return;
        if (r === goalNode.r && c === goalNode.c && drawMode !== 'goal') return;

        if (drawMode === 'wall') {
            if (gridData[r][c] !== 'start' && gridData[r][c] !== 'goal') {
                gridData[r][c] = gridData[r][c] === 'wall' ? 'empty' : 'wall';
                renderGrid();
            }
        } else if (drawMode === 'start') {
            gridData[startNode.r][startNode.c] = 'empty';
            startNode = { r, c };
            gridData[startNode.r][startNode.c] = 'start';
            renderGrid();
        } else if (drawMode === 'goal') {
            gridData[goalNode.r][goalNode.c] = 'empty';
            goalNode = { r, c };
            gridData[goalNode.r][goalNode.c] = 'goal';
            renderGrid();
        }
    }

    function clearVisualization() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gridData[r][c] === 'visited' || gridData[r][c] === 'path') {
                    gridData[r][c] = 'empty';
                }
                const cell = document.getElementById(`cell-${r}-${c}`);
                if (cell) cell.textContent = '';
            }
        }
        renderGrid();
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function runAlgorithm() {
        if (isRunning) return;

        clearVisualization();
        hideResults();
        initLogs();

        isRunning = true;
        setControlsDisabled(true);

        const algo = algoSelect.value;
        const result = { success: false, path: [], visitedCount: 0 };

        if (algo === 'bfs') {
            await bfs(result);
        } else if (algo === 'dfs') {
            await dfs(result);
        } else if (algo === 'dls') {
            const limit = parseInt(depthInput.value) || 20;
            await dls(result, limit);
        }

        if (!isRunning) {
            // means user stopped
            setControlsDisabled(false);
            return;
        }

        if (result.success && result.path.length > 0) {
            await drawPath(result.path);
        }

        showResults(algo, result);

        isRunning = false;
        setControlsDisabled(false);
    }

    const getNeighbors = (r, c) => {
        const neighbors = [];
        const dr = [-1, 0, 1, 0];
        const dc = [0, 1, 0, -1];
        for (let i = 0; i < 4; i++) {
            const nr = r + dr[i];
            const nc = c + dc[i];
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && gridData[nr][nc] !== 'wall') {
                neighbors.push({ r: nr, c: nc });
            }
        }
        return neighbors;
    };


    // --- Algorithms ---

    async function bfs(result) {
        const queue = [{ r: startNode.r, c: startNode.c, path: [{ r: startNode.r, c: startNode.c }] }];
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        visited[startNode.r][startNode.c] = true;

        logStep(`Step 1: Added Start (${startNode.r}, ${startNode.c}) to Queue`);

        while (queue.length > 0) {
            if (!isRunning) return;
            const { r, c, path } = queue.shift();
            const parent = path.length > 1 ? path[path.length - 2] : (path.length === 1 ? startNode : null);

            if (r === goalNode.r && c === goalNode.c) {
                logStep(`Success: Reached Goal at (${r}, ${c})!`);
                const nodeId = `${r}-${c}`;
                const parentId = parent ? `${parent.r}-${parent.c}` : `${startNode.r}-${startNode.c}`;
                addGraphNode(nodeId, parentId, stepCounter, r, c, false, true);
                setCellText(r, c, stepCounter);
                stepCounter++;
                result.success = true;
                result.path = path;
                sendToGraph({ type: 'fit' });
                return;
            }

            if (!(r === startNode.r && c === startNode.c)) {
                gridData[r][c] = 'visited';
                updateCellVisual(r, c, 'visited');
                const nodeId = `${r}-${c}`;
                const parentId = parent ? `${parent.r}-${parent.c}` : `${startNode.r}-${startNode.c}`;
                addGraphNode(nodeId, parentId, stepCounter, r, c);
                setCellText(r, c, stepCounter);
                result.visitedCount++;
                logStep(`Step ${stepCounter++}: Visited (${r}, ${c}) from (${parent.r}, ${parent.c})`);
                await sleep(animSpeed);
            } else {
                addGraphNode(`${r}-${c}`, null, stepCounter, r, c, true, false);
                setCellText(r, c, stepCounter);
                logStep(`Step ${stepCounter++}: Started at (${r}, ${c})`);
            }

            const neighbors = getNeighbors(r, c);
            for (const n of neighbors) {
                if (!visited[n.r][n.c]) {
                    visited[n.r][n.c] = true;
                    if (!(n.r === goalNode.r && n.c === goalNode.c)) {
                        updateCellVisual(n.r, n.c, 'visited-search');
                    }
                    logStep(`  -> Enqueued neighbor (${n.r}, ${n.c})`);
                    queue.push({ r: n.r, c: n.c, path: [...path, { r: n.r, c: n.c }] });
                }
            }
        }
        logStep(`Completed BFS: Goal not found.`);
        sendToGraph({ type: 'fit' });
    }

    async function dfs(result) {
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

        async function dfsRecursive(r, c, path) {
            if (!isRunning) return false;

            if (visited[r][c]) return false;
            visited[r][c] = true;

            const parent = path.length > 1 ? path[path.length - 2] : (path.length === 1 ? startNode : null);

            if (r === goalNode.r && c === goalNode.c) {
                logStep(`Success: Reached Goal at (${r}, ${c})!`);
                const nodeId = `${r}-${c}`;
                const parentId = parent ? `${parent.r}-${parent.c}` : `${startNode.r}-${startNode.c}`;
                addGraphNode(nodeId, parentId, stepCounter, r, c, false, true);
                setCellText(r, c, stepCounter++);
                result.success = true;
                result.path = path;
                sendToGraph({ type: 'fit' });
                return true;
            }

            if (!(r === startNode.r && c === startNode.c)) {
                gridData[r][c] = 'visited';
                updateCellVisual(r, c, 'visited');
                const nodeId = `${r}-${c}`;
                const parentId = parent ? `${parent.r}-${parent.c}` : `${startNode.r}-${startNode.c}`;
                addGraphNode(nodeId, parentId, stepCounter, r, c);
                setCellText(r, c, stepCounter++);
                result.visitedCount++;
                logStep(`Step ${stepCounter - 1}: Visited (${r}, ${c}) from (${parent.r}, ${parent.c})`);
                await sleep(animSpeed);
            } else {
                addGraphNode(`${r}-${c}`, null, stepCounter, r, c, true, false);
                setCellText(r, c, stepCounter++);
                logStep(`Step ${stepCounter - 1}: Started at (${r}, ${c})`);
            }

            const neighbors = getNeighbors(r, c);
            for (const n of neighbors) {
                if (!visited[n.r][n.c]) {
                    if (!(n.r === goalNode.r && n.c === goalNode.c)) {
                        updateCellVisual(n.r, n.c, 'visited-search');
                    }
                    if (await dfsRecursive(n.r, n.c, [...path, { r: n.r, c: n.c }])) {
                        return true;
                    }
                }
            }
            return false;
        }

        await dfsRecursive(startNode.r, startNode.c, [{ r: startNode.r, c: startNode.c }]);
        if (!result.success) {
            logStep(`Completed DFS: Goal not found.`);
            sendToGraph({ type: 'fit' });
        }
    }

    async function dls(result, limit) {
        const visitedInfo = Array.from({ length: rows }, () => Array(cols).fill(Infinity));

        async function dlsRecursive(r, c, path, depth) {
            if (!isRunning) return false;

            if (depth >= visitedInfo[r][c]) return false;
            visitedInfo[r][c] = depth;

            const parent = path.length > 1 ? path[path.length - 2] : (path.length === 1 ? startNode : null);

            if (r === goalNode.r && c === goalNode.c) {
                logStep(`Success: Reached Goal at (${r}, ${c})!`);
                const nodeId = `${r}-${c}`;
                const parentId = parent ? `${parent.r}-${parent.c}` : `${startNode.r}-${startNode.c}`;
                addGraphNode(nodeId, parentId, stepCounter, r, c, false, true);
                setCellText(r, c, stepCounter++);
                result.success = true;
                result.path = path;
                sendToGraph({ type: 'fit' });
                return true;
            }

            if (!(r === startNode.r && c === startNode.c)) {
                gridData[r][c] = 'visited';
                updateCellVisual(r, c, 'visited');
                const nodeId = `${r}-${c}`;
                const parentId = parent ? `${parent.r}-${parent.c}` : `${startNode.r}-${startNode.c}`;
                addGraphNode(nodeId, parentId, stepCounter, r, c);
                setCellText(r, c, stepCounter++);
                result.visitedCount++;
                logStep(`Step ${stepCounter - 1}: Visited (${r}, ${c}) from (${parent.r}, ${parent.c}), depth=${depth}`);
                await sleep(animSpeed);
            } else {
                addGraphNode(`${r}-${c}`, null, stepCounter, r, c, true, false);
                setCellText(r, c, stepCounter++);
                logStep(`Step ${stepCounter - 1}: Start at (${r}, ${c}), depth=${depth}`);
            }

            if (depth >= limit) {
                logStep(`Step ${stepCounter}: Depth limit reached at (${r}, ${c}), backtracking.`);
                return false;
            }

            const neighbors = getNeighbors(r, c);
            for (const n of neighbors) {
                if (!(n.r === goalNode.r && n.c === goalNode.c)) {
                    updateCellVisual(n.r, n.c, 'visited-search');
                }
                if (await dlsRecursive(n.r, n.c, [...path, { r: n.r, c: n.c }], depth + 1)) {
                    return true;
                }
            }
            logStep(`Step ${stepCounter}: Backtracking from (${r}, ${c})`);
            return false;
        }

        await dlsRecursive(startNode.r, startNode.c, [{ r: startNode.r, c: startNode.c }], 0);
        if (!result.success) {
            logStep(`Completed DLS: Goal not found.`);
            sendToGraph({ type: 'fit' });
        }
    }

    async function drawPath(path) {
        sendToGraph({ type: 'path', path: path });

        const p = path.slice(1, path.length - 1);
        for (const loc of p) {
            gridData[loc.r][loc.c] = 'path';
            updateCellVisual(loc.r, loc.c, 'path');
            await sleep(40);
        }
    }

    // --- UI Helpers ---
    function setControlsDisabled(disabled) {
        // We let users stop the algorithm by clicking clear path
        generateBtn.disabled = disabled;
        runBtn.disabled = disabled;
        runBtn.innerHTML = disabled ? '⏳ Running...' : '🚀 Run Algorithm';
        clearGridBtn.disabled = disabled;
    }

    function showResults(algo, result) {
        resultsPanel.classList.remove('hidden');

        const algoNames = {
            'bfs': 'Breadth First Search',
            'dfs': 'Depth First Search',
            'dls': 'Depth Limited Search (Limit: ' + depthInput.value + ')'
        };

        resAlgo.textContent = algoNames[algo];

        if (result.success) {
            resStatus.textContent = "Path Found ✅";
            resStatus.style.color = "#48BB78";
        } else {
            resStatus.textContent = "No Path Found ❌";
            resStatus.style.color = "#F56565";
        }

        resVisited.textContent = result.visitedCount;
        resLength.textContent = result.success ? result.path.length : '-';
    }

    function hideResults() {
        resultsPanel.classList.add('hidden');
    }

});
