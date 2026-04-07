let network = null;
let graphNodes = null;
let graphEdges = null;
const statusEl = document.getElementById('status');

function initNetwork() {
    const container = document.getElementById('graph-container');

    if (typeof vis === 'undefined') {
        statusEl.textContent = "Error: Vis Network Script Blocked or Offline";
        statusEl.style.color = "#ef4444";
        return;
    }

    graphNodes = new vis.DataSet([]);
    graphEdges = new vis.DataSet([]);

    const graphData = { nodes: graphNodes, edges: graphEdges };
    const options = {
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                nodeSpacing: 100,
                levelSeparation: 120
            }
        },
        nodes: {
            shape: 'circle',
            color: { background: '#ffffff', border: '#f97316', highlight: { background: '#fff7ed', border: '#ea580c' } },
            font: { color: '#0f172a', size: 18, face: 'Inter' },
            borderWidth: 3,
            size: 25
        },
        edges: {
            color: '#f97316', width: 2,
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 }
        },
        physics: {
            hierarchicalRepulsion: { nodeDistance: 90, avoidOverlap: 1 }
        }
    };

    network = new vis.Network(container, graphData, options);
}

initNetwork();

window.addEventListener('message', (event) => {
    const data = event.data;
    if (data.type === 'clear') {
        if (graphNodes) graphNodes.clear();
        if (graphEdges) graphEdges.clear();
        statusEl.textContent = 'Algorithm computing paths dynamically...';
        statusEl.style.color = '#3b82f6';
    } else if (data.type === 'node') {
        let color = { background: '#ffffff', border: '#f97316', highlight: { background: '#fff7ed', border: '#ea580c' } };
        if (data.isStart) {
            color = { background: '#4ade80', border: '#16a34a', highlight: { background: '#22c55e', border: '#14532d' } };
        } else if (data.isGoal) {
            color = { background: '#f87171', border: '#b91c1c', highlight: { background: '#ef4444', border: '#7f1d1d' } };
        }

        if (graphNodes && !graphNodes.get(data.id)) {
            graphNodes.add({ id: data.id, label: String(data.labelText), title: `Node (${data.r}, ${data.c})`, color: color });
        }
        if (graphEdges && data.parentId && data.id !== data.parentId) {
            const edgeId = `${data.parentId}-${data.id}`;
            if (!graphEdges.get(edgeId)) {
                graphEdges.add({ id: edgeId, from: data.parentId, to: data.id });
            }
        }
    } else if (data.type === 'path') {
        const p = data.path;
        for (let i = 0; i < p.length; i++) {
            const nodeId = `${p[i].r}-${p[i].c}`;

            // Highlight intermediate nodes on the path sequence
            if (i > 0 && i < p.length - 1) {
                if (graphNodes && graphNodes.get(nodeId)) {
                    graphNodes.update({
                        id: nodeId,
                        color: { background: '#bfdbfe', border: '#2563eb', highlight: { background: '#93c5fd', border: '#1d4ed8' } }
                    });
                }
            }

            // Highlight the relational edges spanning the path
            if (i > 0) {
                const prevId = `${p[i - 1].r}-${p[i - 1].c}`;
                const edgeId = `${prevId}-${nodeId}`;
                if (graphEdges && graphEdges.get(edgeId)) {
                    graphEdges.update({
                        id: edgeId,
                        color: { color: '#3b82f6', highlight: '#2563eb' },
                        width: 5
                    });
                }
            }
        }
    } else if (data.type === 'fit') {
        if (network) {
            network.fit({ animation: { duration: 800, easingFunction: "easeInOutQuad" } });
        }
        statusEl.textContent = 'Traversal Map Complete.';
        statusEl.style.color = '#10b981';
    }
});

// Acknowledge open stream
if (window.opener) {
    window.opener.postMessage({ type: 'ready' }, '*');
}
