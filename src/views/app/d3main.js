
class BookmarkGraph {
    constructor() {
        this.bookmarks = [];
        this.folders = [];
        this.graph = null;
        this.init();
    }

    async init() {
        await this.loadBookmarks();
        this.createGraph();
    }

    async loadBookmarks() {
        try {
            const bookmarkTree = await chrome.bookmarks.getTree();
            this.processBookmarks(bookmarkTree);
        } catch (error) {
            console.error('Ошибка загрузки закладок:', error);
        }
    }

    processBookmarks(bookmarkTree) {
        this.bookmarks = [];
        this.folders = [];

        const processNode = (node, parentFolder = null) => {
            if (node.url) {
                // Это закладка - добавляем
                this.bookmarks.push({
                    id: node.id,
                    title: node.title || 'Без названия',
                    url: node.url,
                    folder: parentFolder
                });
            } else if (node.children) {
                // Это папка (или корневой узел)
                if (node.id !== '0') { // Пропускаем корневой узел как папку
                    const folder = {
                        id: node.id,
                        name: node.title || 'Без названия',
                        bookmarks: []
                    };
                    this.folders.push(folder);

                    // Обрабатываем детей с новой родительской папкой
                    node.children.forEach(child => processNode(child, folder.name));
                } else {
                    // Для корневого узла обрабатываем детей без родительской папки
                    node.children.forEach(child => processNode(child, parentFolder));
                }
            }
        };

        bookmarkTree.forEach(root => processNode(root));
    }

    createGraph() {
        // Создаем узлы и связи
        const nodes = [];
        const links = [];

        // Добавляем папки как узлы
        this.folders.forEach(folder => {
            nodes.push({
                id: folder.id,
                title: folder.name,
                type: 'folder',
                url: null,
                radius: 12
            });
        });

        // Добавляем закладки как узлы
        this.bookmarks.forEach(bookmark => {
            nodes.push({
                id: bookmark.id,
                title: bookmark.title,
                type: 'bookmark',
                url: bookmark.url,
                folder: bookmark.folder,
                radius: 8
            });

            // Создаем связь между закладкой и её папкой
            if (bookmark.folder) {
                const folder = this.folders.find(f => f.name === bookmark.folder);
                if (folder) {
                    links.push({
                        source: folder.id,
                        target: bookmark.id
                    });
                }
            }
        });

        // Добавляем корневой узел для лучшей организации
        nodes.push({
            id: 'root',
            title: 'Закладки',
            type: 'root',
            url: null,
            radius: 15
        });

        // Связываем папки с корневым узлом
        this.folders.forEach(folder => {
            links.push({
                source: 'root',
                target: folder.id
            });
        });

        // Инициализируем граф
        this.renderGraph(nodes, links);
    }

    renderGraph(nodes, links) {
        const container = document.getElementById('graph');
        if (!container) return;

        // Очищаем контейнер
        container.innerHTML = '';

        this.graph = ObsidianForceGraph({
            nodes: nodes,
            links: links
        }, {
            width: window.innerWidth,
            height: window.innerHeight,
            nodeRadius: d => d.radius || 8,
            nodeTitle: d => {
                if (d.type === 'root') return d.title;
                if (d.type === 'folder') return d.title;
                return d.title;
            }
        });

        container.appendChild(this.graph);
    }
}

// Модифицированная функция графа
function ObsidianForceGraph({
                                nodes,
                                links
                            }, {
                                nodeId = d => d.id,
                                nodeTitle = d => d.id,
                                nodeRadius = 8,
                                width = 800,
                                height = 600,
                                invalidation
                            } = {}) {
    // Compute values
    const N = d3.map(nodes, nodeId).map(intern);
    const LS = d3.map(links, ({source}) => source).map(intern);
    const LT = d3.map(links, ({target}) => target).map(intern);
    const T = d3.map(nodes, nodeTitle);
    const NodeTypes = d3.map(nodes, d => d.type);
    const NodeUrls = d3.map(nodes, d => d.url);
    const NodeTitles = d3.map(nodes, d => d.title);

    // Replace with mutable objects
    nodes = d3.map(nodes, (_, i) => ({
        id: N[i],
        title: NodeTitles[i],
        displayTitle: T[i],
        type: NodeTypes[i],
        url: NodeUrls[i],
        x: Math.random() * width - width/2,
        y: Math.random() * height - height/2,
        radius: NodeTypes[i] === 'root' ? 15 :
            NodeTypes[i] === 'folder' ? 12 : 8
    }));

    links = d3.map(links, (_, i) => ({
        source: LS[i],
        target: LT[i]
    }));

    // Forces - настраиваем физику для лучшего отображения
    const forceNode = d3.forceManyBody()
        .strength(d => {
            if (d.type === 'root') return -200;
            if (d.type === 'folder') return -100;
            return -50;
        })
        .distanceMin(30)
        .distanceMax(200);

    const forceLink = d3.forceLink(links)
        .id(d => d.id)
        .distance(d => {
            if (d.source.type === 'root' || d.target.type === 'root') return 350;
            if (d.source.type === 'folder' || d.target.type === 'folder') return 200;
            return 80;
        })
        .strength(0.2);

    const simulation = d3.forceSimulation(nodes)
        .force("link", forceLink)
        .force("charge", forceNode)
        .force("center", d3.forceCenter())
        .force("collision", d3.forceCollide().radius(d => d.radius + 35)) // Увеличиваем радиус столкновений
        .alphaDecay(0.02)
        .velocityDecay(0.4);

    // SVG
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width/2, -height/2, width, height])
        .attr("class", "graph-svg");

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
        });

    svg.call(zoom);

    const container = svg.append("g");

    // Links
    const link = container.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", d => {
            const baseClass = "link";
            return (d.source.type === 'root' || d.target.type === 'root') ?
                `${baseClass} link-root` : baseClass;
        });

    // Nodes
    const node = container.append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", d => `node node-${d.type}`)
        .attr("r", d => d.radius)
        .call(drag(simulation))
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleNodeClick);

    // Labels - исправляем отображение названий
    const label = container.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("class", d => `node-label node-label-${d.type}`)
        .text(d => {
            const maxLength = 20;
            const text = d.displayTitle || d.title || '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        })
        .style("pointer-events", "none") // Оставляем только необходимые стили
        .style("user-select", "none");   // которые нельзя задать через CSS

    // Interaction functions
    let activeNode = null;

    function handleMouseOver(event, d) {
        if (activeNode) return;
        event.stopPropagation();

        if (d.type === 'bookmark' && d.url) {
            showTooltip(event, d);
        }

        const connectedNodes = new Set([d.id]);
        const connectedLinks = [];

        links.forEach(link => {
            if (link.source.id === d.id || link.target.id === d.id) {
                connectedLinks.push(link);
                connectedNodes.add(link.source.id);
                connectedNodes.add(link.target.id);
            }
        });

        // Применяем классы вместо inline-стилей
        link
            .classed("link-highlighted", l => connectedLinks.includes(l))
            .classed("fade", l => !connectedLinks.includes(l));

        node
            .classed("node-highlighted", n => n.id === d.id)
            .classed("node-connected", n => connectedNodes.has(n.id) && n.id !== d.id)
            .classed("fade", n => !connectedNodes.has(n.id));

        label
            .classed("fade", n => !connectedNodes.has(n.id))
            .classed("node-label-highlighted", n => n.id === d.id);
    }

    function handleMouseOut(event, d) {
        if (activeNode) return;
        event.stopPropagation();

        hideTooltip();

        // Reset all styles
        link
            .classed("link-highlighted", false)
            .classed("fade", false);

        node
            .classed("node-highlighted", false)
            .classed("node-connected", false)
            .classed("fade", false);

        label
            .classed("fade", false)
            .classed("node-label-highlighted", false);
    }

    function handleNodeClick(event, d) {
        event.stopPropagation();

        if (d.type === 'bookmark' && d.url) {
            // Открываем закладку в новой вкладке
            chrome.tabs.create({ url: d.url });
        }
    }

    function showTooltip(event, d) {
        let tooltip = d3.select(".bookmark-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body")
                .append("div")
                .attr("class", "bookmark-tooltip");
        }

        tooltip
            .html(`<div>${d.title}</div>
               <div>${d.url}</div>`)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 15) + "px")
            .style("display", "block");
    }

    function hideTooltip() {
        d3.select(".bookmark-tooltip").style("display", "none");
    }

    function drag(simulation) {
        function dragstarted(event) {
            hideTooltip();

            d3.selectAll('.node').classed('node-highlighted', false);
            d3.selectAll('.node-connected', false);
            d3.selectAll('.fade', false);
            d3.selectAll('.link-highlighted', false);
            d3.selectAll('.node-label-highlighted', false);

            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            if (!event.subject.fixed) {
                event.subject.fx = null;
                event.subject.fy = null;
            }
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    // Click on background to reset
    svg.on("click", function(event) {
        if (event.target === this) {
            activeNode = null;
            handleMouseOut();
            hideTooltip();
        }
    });

    // Simulation tick
    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        label
            .attr("x", d => d.x)
            .attr("y", d => d.y + d.radius + 15);
    }

    simulation.on("tick", ticked);

    function intern(value) {
        return value !== null && typeof value === "object" ? value.valueOf() : value;
    }

    if (invalidation) invalidation.then(() => simulation.stop());

    return svg.node();
}


// Инициализация графа при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    new BookmarkGraph();
});

// Обработка изменения размера окна
window.addEventListener("resize", function() {
    d3.select("#graph svg")
        .attr("width", window.innerWidth)
        .attr("height", window.innerHeight);
});