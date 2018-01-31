var app = angular.module('sparqlVisualiser', ['ngRoute', 'ui.bootstrap', 'ngclipboard', 'ui.codemirror']);

//configure routes
app.config(function($routeProvider) {
	$routeProvider
		//route for the home page
		.when('/', {
			templateUrl : 'pages/queryLog.html',
			controller : 'queryLogController'
		})
		// route for the visualisation page
		.when('/visualisation', {
			templateUrl : 'pages/visualisation.html',
			controller : 'visualisationController'	
		})
		// route for the results page
		.when('/results', {
			templateUrl : 'pages/results.html',
			controller : 'resultsController'	
		})
		.when('/debugging', {
			templateUrl : 'pages/debugging.html',
			controller : 'debuggingController'	
		});

});


app.factory('queryLogService',function ($http, $rootScope) {
	var queryLogServiceObject = {};
	queryLogServiceObject.receivedQueries = [];
	queryLogServiceObject.selectedQuery = {};
	queryLogServiceObject.resultsHeader = [];
	queryLogServiceObject.resultsData = [];	

	queryLogServiceObject.getQueriesFromProxy = function (){
    	queryLogServiceObject.receivedQueries = [];
    	$http.get('http://localhost:5060').then(processReceivedQueries);	
    };    

    function processReceivedQueries(queries){
    	var	 id = 1;
		queries.data.forEach(function (query){
			var newQuery = new Object();
			newQuery.id = id;
			newQuery.date = new Date(query.time);
			newQuery.host = query.host;
			newQuery.url = query.url;
			newQuery.destinationUrl = query.destinationUrl;
			newQuery.client = query.client;
			newQuery.userAgent = query.userAgent;
			// extract information from inside the query
			newQuery.queryString = query.query;
			newQuery.prefixes = extractPrefixes(query.query);
			newQuery.coreQuery = extractCoreQuery(query.query);
			newQuery.keywordString = extractKeywords(query.query);

			queryLogServiceObject.receivedQueries.unshift(newQuery);

			id++;
		});
		// check all queries
		checkStatusForQueries();

		queryLogServiceObject.selectedQuery = queryLogServiceObject.receivedQueries[0];
	};

	function checkStatusForQueries() {

		queryLogServiceObject.receivedQueries.forEach( function (query) {
			//with .bind, you can access the binded object in the callback function, or access parameters in the callback function
			$http.get(query.destinationUrl + query.url).then(assignStatus.bind( {queryObject: query} ), assignStatus.bind( {queryObject: query} ) );	
		})
		

		function assignStatus(response){
			// status codes: https://de.wikipedia.org/wiki/HTTP-Statuscode
			if (response.status >= 400 && response.status < 500) {
				//client failure
				this.queryObject.success = false;	
				this.queryObject.statusText = response.statusText;
				this.queryObject.debugText = response.data;	
			}
			else if (response.status >= 200 && response.status < 300) 
			{
				//all fine
				this.queryObject.success = true;	
				this.queryObject.statusText = response.statusText;
			}
			
		};
	};

	function extractPrefixes(queryString) {
		var index = queryString.indexOf("PREFIX",0);
		var indexEndOfLastPrefix = 0;
		var count = 0;
		while (index != -1)
		{
			count++;
			indexEndOfLastPrefix = queryString.indexOf(">",index);
			index = queryString.indexOf("PREFIX",index + 1);						
		}
		if (count > 0) 
		{
			return queryString.substring(0,indexEndOfLastPrefix);	
		}
		else
		{
			return "no Prefixes found!";
		}	

	}

	function extractCoreQuery(queryString) {
		var index = queryString.indexOf("PREFIX",0);
		var indexEndOfLastPrefix = 0;
		var indexBeginCoreQuery = 0;
		var count = 0;
		while (index != -1)
		{
			count++;
			indexEndOfLastPrefix = queryString.indexOf(">",index);
			index = queryString.indexOf("PREFIX",index + 1);						
		}
		if (count > 0) 
		{
			//https://www.w3schools.com/jsref/jsref_obj_regexp.asp
			//search for the first non whitespace charakter, after the prfeix region
			indexBeginCoreQuery = indexEndOfLastPrefix + 1 + queryString.substring(indexEndOfLastPrefix + 1,queryString.length).search(/\S/);
		}		

		return queryString.substring(indexBeginCoreQuery, queryString.length);	
	
	}

	function extractKeywords(queryString){
		var keywords = ["SELECT","SELECT DISTINCT","SELECT FROM",
		"WHERE","FILTER","ORDER BY","LIMIT","UNION","INSERT","INSERT DATA",
		"GRAPH","SERVICE","OPTIONAL","BIND","MINUS","DELETE","CONSTRUCT",];
		var keywordString = "";

		keywords.forEach(function (keyword){
			var count = 0;
			var index = queryString.indexOf(keyword,index + keyword.length);			
			while (index != -1)
			{
				count++;
				index = queryString.indexOf(keyword,index + keyword.length);								
			}
			if (count > 0) {
				keywordString += keyword + "(" + count + "),";	
			}
			
		});
		return keywordString;	
	};


	queryLogServiceObject.getResultsFromQuery = function (query){   
    	var targetUrl = query.destinationUrl + query.url;
    	var index = targetUrl.indexOf("format=",0);
    	var targetUrlWithJSONFormat = targetUrl.substring(0,index) + "format=application%2Fsparql-results%2Bjson&timeout=0&debug=on";
    	$http.get(targetUrlWithJSONFormat).then(processResultsForQuery);	
    };

    function processResultsForQuery (results){
    	console.log('process results');
    	queryLogServiceObject.resultsHeader = [];
    	queryLogServiceObject.resultsData = results.data.results.bindings;

    	results.data.head.vars.forEach(function (element){
    		queryLogServiceObject.resultsHeader.unshift(element);
    	});
    };

    //get queries from proxy
    queryLogServiceObject.getQueriesFromProxy();

	return queryLogServiceObject;
});


app.controller('queryLogController', function($scope,$filter, $http, $location, queryLogService) {
	//init codemirror
	$scope.editorOptions = {
		lineWrapping : true,
		lineNumbers: true,
		height : 'auto',
		viewportMargin: Infinity,
		scrollbarStyle: 'null',
		readOnly: true,
		mode: 'sparql'
	};

	//link data to view
	$scope.queryLogService = queryLogService;	
    
    $scope.initRowSelection = function(){
    	$scope.selectedRow = 0;	
    };    
    
    //link refresh function to view
    $scope.refreshQueries = function(){
		$scope.queryLogService.getQueriesFromProxy();
    };
	
	$scope.setSelection = function(rowIndex,query) {
		$scope.queryLogService.selectedQuery = $filter('filter')(queryLogService.receivedQueries, {'id':query.id})[0];
		$scope.selectedRow = rowIndex;
	};

	$scope.openVisualisation = function(query){
		$scope.queryLogService.selectedQuery = $filter('filter')(queryLogService.receivedQueries, {'id':query.id})[0];
		$location.path('visualisation');
	};
	
	$scope.openExecutionDetails = function(query){
		$scope.queryLogService.selectedQuery = $filter('filter')(queryLogService.receivedQueries, {'id':query.id})[0];
		if ($scope.queryLogService.selectedQuery.success) 
		{
			$location.path('results');	
		}
		else 
		{
			$location.path('debugging');	
		}
		
	};

	$scope.openResults = function(){
		$location.path('results');
	};

	$scope.openDebugging = function(){
		$location.path('debugging');
	};
	
});

app.controller('resultsController', function($scope, $http, queryLogService) {

	$scope.editorOptions = {
		lineWrapping : true,
		lineNumbers: true,
		height : 'auto',
		viewportMargin: Infinity,
		scrollbarStyle: 'null',
		readOnly: true,
		mode: 'sparql'
	};
	
	//announce the Service to the scope
	$scope.queryLogService = queryLogService;

	$scope.getResults = function () {
		$scope.queryLogService.getResultsFromQuery($scope.queryLogService.selectedQuery);
	}

	//get results after startup
	$scope.getResults();

});

app.controller('debuggingController', function($scope) {
	
	$scope.editorOptions = {
		lineWrapping : true,
		lineNumbers: true,
		height : 'auto',
		viewportMargin: Infinity,
		scrollbarStyle: 'null',
		readOnly: true,
		mode: 'sparql'
	};
});




app.controller('visualisationController_old', function($scope, queryLogService, parseQueryService) {
	
	$scope.editorOptions = {
		lineWrapping : true,
		lineNumbers: true,
		height : 'auto',
		viewportMargin: Infinity,
		scrollbarStyle: 'null',
		readOnly: true,
		mode: 'sparql'
	};

	$scope.queryLogService = queryLogService;
	$scope.parseQueryService = parseQueryService;

	$scope.update = function(){
		$scope.parseQueryService.parse(queryLogService.selectedQuery.queryString);
	};
});


//from here copied from source sparql.js

var sparql;
(function (sparql) {
    var EdgeType;
    (function (EdgeType) {
        EdgeType[EdgeType["INSERT"] = 0] = "INSERT";
        EdgeType[EdgeType["DELETE"] = 1] = "DELETE";
        EdgeType[EdgeType["MINUS"] = 2] = "MINUS";
        EdgeType[EdgeType["OPTIONAL"] = 3] = "OPTIONAL";
        EdgeType[EdgeType["CONSTRUCT"] = 4] = "CONSTRUCT";
        EdgeType[EdgeType["REGULAR"] = 5] = "REGULAR";
    })(EdgeType = sparql.EdgeType || (sparql.EdgeType = {}));
    var NodeType;
    (function (NodeType) {
        NodeType[NodeType["SELECT"] = 0] = "SELECT";
        NodeType[NodeType["REGULAR"] = 1] = "REGULAR";
    })(NodeType = sparql.NodeType || (sparql.NodeType = {}));
    var GraphEdgeType;
    (function (GraphEdgeType) {
        GraphEdgeType[GraphEdgeType["LINEAR"] = 0] = "LINEAR";
        GraphEdgeType[GraphEdgeType["BEZIER_POSITIVE"] = 1] = "BEZIER_POSITIVE";
        GraphEdgeType[GraphEdgeType["BEZIER_NEGATIVE"] = -1] = "BEZIER_NEGATIVE";
    })(GraphEdgeType = sparql.GraphEdgeType || (sparql.GraphEdgeType = {}));
    /**
     * Distance of the first and second curve from the first one
     * @type {number}
     */
    var BEZIER_DISTANCE = 100;
    /**
     * Maximum number of steps for newton's method when calculating the intersection-point of the curve and the ellipse
     * @type {number}
     */
    var MAXIMUM_STEPS = 5;
    var Query = /** @class */ (function () {
        function Query() {
            this.edgeList = [];
            this.nodeList = [];
            this.subGraphList = [];
            this.serviceList = [];
            this.unionList = [];
            this.filterList = [];
            this.bindList = [];
            this.order = null;
            this.limit = Infinity;
        }
        Query.prototype.getEdgeList = function () { return this.edgeList; };
        Query.prototype.addEdge = function (edge) { this.edgeList.push(edge); return this; };
        Query.prototype.getNodeList = function () { return this.nodeList; };
        Query.prototype.addNode = function (node) { this.nodeList.push(node); return this; };
        Query.prototype.getSubGraphList = function () { return this.subGraphList; };
        Query.prototype.addSubGraph = function (subGraph) { this.subGraphList.push(subGraph); return this; };
        Query.prototype.getServiceList = function () { return this.serviceList; };
        Query.prototype.addService = function (service) { this.serviceList.push(service); return this; };
        Query.prototype.getUnionList = function () { return this.unionList; };
        Query.prototype.addUnion = function (union) { this.unionList.push(union); return this; };
        Query.prototype.getFilterList = function () { return this.filterList; };
        Query.prototype.addFilter = function (filter) { this.filterList.push(filter); return this; };
        Query.prototype.getBindList = function () { return this.bindList; };
        Query.prototype.addBind = function (bind) { this.bindList.push(bind); return this; };
        Query.prototype.getOrder = function () { return this.order; };
        Query.prototype.setOrder = function (order) { this.order = order; return this; };
        Query.prototype.getLimit = function () { return this.limit; };
        Query.prototype.setLimit = function (limit) { this.limit = limit; return this; };
        return Query;
    }());
    sparql.Query = Query;
    var Edge = /** @class */ (function () {
        /**
         * Set up a new Edge
         * This edge is automatically added to the start- und end-node's edge-list
         * @param name          the nodes name
         * @param startNode     the start node
         * @param endNode       the end node
         * @param type          the edge's type
         * @param subGraph      the sub-graph that this edge belongs to
         * @param service       the service that this edge belongs to
         */
        function Edge(name, startNode, endNode, type, subGraph, service) {
            if (type === void 0) { type = EdgeType.REGULAR; }
            if (subGraph === void 0) { subGraph = null; }
            if (service === void 0) { service = null; }
            /**
             * A list of all filters this edge belongs to
             * @type {Array}
             */
            this.filterList = [];
            /**
             * A list of all binds this edge belongs to
             * @type {Array}
             */
            this.bindList = [];
            /**
             * A list of all union-operations this edge belongs to
             * @type {Array}
             */
            this.unionList = [];
            /**
             * A list of all order-by-statements this edge belongs to
             * @type {Array}
             */
            this.orderList = [];
            /**
             * The edge-type
             */
            this.edgeType = GraphEdgeType.LINEAR;
            /**
             * The center Point for the Bezier-curve
             * @type {number[]}
             */
            this.centerPoint = [0, 0];
            /**
             * The interjection-point of the edge and the ellipse of the end-node
             * The third and fourth value represents the derivative of the curve in this point
             * @type {number[]}
             */
            this.interjectionPoint = [0, 0, 0, 0];
            /**
             * size of the edge
             */
            this.size = { x: 10, y: 10 };
            this.name = name;
            this.startNode = startNode;
            this.endNode = endNode;
            this.type = type;
            this.subGraph = subGraph;
            this.service = service;
            startNode.addEdge(this);
            endNode.addEdge(this);
            if (subGraph !== null) {
                subGraph.addEdge(this);
                startNode.addSubGraph(subGraph);
                endNode.addSubGraph(subGraph);
            }
            if (service !== null) {
                service.addEdge(this);
                startNode.addService(service);
                endNode.addService(service);
            }
        }
        /**
         * Get this edge's name
         * @returns {string}
         */
        Edge.prototype.getName = function () {
            return this.name;
        };
        /**
         * get this edge's start-node
         * @returns {Node}
         */
        Edge.prototype.getStartNode = function () {
            return this.startNode;
        };
        /**
         * get this edges's end-node
         * @returns {Node}
         */
        Edge.prototype.getEndNode = function () {
            return this.endNode;
        };
        /**
         * get this edge's edge-type
         * @returns {EdgeType}
         */
        Edge.prototype.getType = function () {
            return this.type;
        };
        /**
         * get this edges's subgraph
         * @returns {SubGraph}
         */
        Edge.prototype.getSubgraph = function () {
            return this.subGraph;
        };
        /**
         * Get all filters that this edge belongs to
         * @returns {Filter[]}
         */
        Edge.prototype.getFilterList = function () {
            return this.filterList;
        };
        /**
         * Add a filter that this edge belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param filter
         * @returns {Edge}
         */
        Edge.prototype.addFilter = function (filter) {
            this.filterList.push(filter);
            return this;
        };
        /**
         * Get all binds that this edge belongs to
         * @returns {Filter[]}
         */
        Edge.prototype.getBindList = function () {
            return this.bindList;
        };
        /**
         * Add a bind that this edge belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param bind
         * @returns {Edge}
         */
        Edge.prototype.addBind = function (bind) {
            this.bindList.push(bind);
            return this;
        };
        /**
         * Get all union-operations that this edge belongs to
         * @returns {Union[]}
         */
        Edge.prototype.getUnionList = function () {
            return this.unionList;
        };
        /**
         * Add an union-operation that this edge belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param union
         * @returns {Edge}
         */
        Edge.prototype.addUnion = function (union) {
            this.unionList.push(union);
            this.startNode.addUnion(union);
            this.endNode.addUnion(union);
            return this;
        };
        /**
         * Get all order-by-statements that this edge belongs to
         * @returns {Order[]}
         */
        Edge.prototype.getOrderList = function () {
            return this.orderList;
        };
        /**
         * Add a order-by-statements that this edge belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param order
         * @returns {Edge}
         */
        Edge.prototype.addOrder = function (order) {
            this.orderList.push(order);
            return this;
        };
        /**
         * Get the service that this edge belongs to
         * @returns {Service}
         */
        Edge.prototype.getService = function () {
            return this.service;
        };
        Edge.prototype.isInsert = function () {
            return this.getType() === EdgeType.INSERT;
        };
        Edge.prototype.isDelete = function () {
            return this.getType() === EdgeType.DELETE;
        };
        Edge.prototype.isMinus = function () {
            return this.getType() === EdgeType.MINUS;
        };
        Edge.prototype.isOptional = function () {
            return this.getType() === EdgeType.OPTIONAL;
        };
        Edge.prototype.isConstruct = function () {
            return this.getType() === EdgeType.CONSTRUCT;
        };
        Edge.prototype.setType = function (type) {
            this.edgeType = type;
            return this;
        };
        /**
         * get the center point
         * returns [x, y]
         * @returns {number[]}
         */
        Edge.prototype.getCenterPoint = function () {
            return this.centerPoint;
        };
        Edge.prototype.updateCenterPoint = function () {
            var x = this.startNode.getX(), y = this.startNode.getY();
            var dx = this.endNode.getX() - x, dy = this.endNode.getY() - y;
            var distanceFromCenter = this.edgeType * BEZIER_DISTANCE;
            var distanceBetweenStartAndEnd = Math.sqrt(dx * dx + dy * dy);
            x += dx / 2 + distanceFromCenter * dy / distanceBetweenStartAndEnd;
            y += dy / 2 - distanceFromCenter * dx / distanceBetweenStartAndEnd;
            this.centerPoint = [x, y];
        };
        /**
         * Update the interjection-point of the bezier-curve associated with this edge and the ellipse associated with
         * the end-node - this is the point the arrow points to
         * The derivative dy/dy in this point is also provided, so we know how the direction the arrow should be
         * pointing to
         */
        Edge.prototype.updateInterjectionPoint = function () {
            // The center point of the quadratic bezier-curve
            var _a = this.getCenterPoint(), x1 = _a[0], y1 = _a[1];
            // for this calculation we assume, that the end-node is at the center of our coordinate-system
            x1 -= this.endNode.getX();
            y1 -= this.endNode.getY();
            // The end point of the quadratic bezier-curve
            var x2 = this.startNode.getX() - this.endNode.getX(), y2 = this.startNode.getY() - this.endNode.getY();
            // get the ellipse-parameters of the end-point
            var a = this.endNode.getEllipseParameterX(), b = this.endNode.getEllipseParameterY();
            // we will need these calculations more often, so we store the result
            var aSquared = a * a, bSquared = b * b, x2Minus2x1 = x2 - 2 * x1, y2Minus2y1 = y2 - 2 * y1;
            // initial value is solution for distanceFromCenter = 0 (see function getCenterPoint)
            // this equals this.type == GraphEdgeType.LINEAR
            var t_n = a * b / Math.sqrt(x2 * x2 * bSquared + y2 * y2 * aSquared);
            // for a given bezier-curve we can calculate the curve as a function of t
            var x_t = function (t) {
                return t * (2 * x1 + x2Minus2x1 * t);
            }, y_t = function (t) {
                return t * (2 * y1 + y2Minus2y1 * t);
            };
            // for a non-linear curve, the parameter t will be slightly different
            // so we use newton's method to calculate it numerically
            if (this.edgeType !== GraphEdgeType.LINEAR) {
                // this is the function we want calculate the zero-crossing point for
                // this is basically just the ellipse-equation with x_t and y_t substituted (see the functions x_t and y_t)
                var f = function (t) {
                    // ((x2 - 2 x1)^2 b^2 + (y2 - 2 y1)^2 a^2) t^4 + 4 (x1 (x2 - 2 x1) b^2 + y1 (y2 - 2 y1) a^2) t^3 + 4 (x1^2 b^2 + y1^2 a^2) t^2 - a^2 b^2
                    return (x2Minus2x1 * x2Minus2x1 * bSquared + y2Minus2y1 * y2Minus2y1 * aSquared) * t * t * t * t +
                        4 * (x1 * x2Minus2x1 * bSquared + y1 * y2Minus2y1 * aSquared) * t * t * t +
                        4 * (x1 * x1 * bSquared + y1 * y1 * aSquared) * t * t - aSquared * bSquared;
                }, 
                // for newton's method we also need the derivative of the function f, here it is
                df_dt = function (t) {
                    // 4 * ((x2 - 2 x1)^2 b^2 + (y2 - 2 y1)^2 a^2) t^3 + 12 (x1 (x2 - 2 x1) b^2 + y1 (y2 - 2 y1) a^2) t^2 + 8 (x1^2 b^2 + y1^2 a^2) t
                    return 4 * (x2Minus2x1 * x2Minus2x1 * bSquared + y2Minus2y1 * y2Minus2y1 * aSquared) * t * t * t +
                        12 * (x1 * x2Minus2x1 * bSquared + y1 * y2Minus2y1 * aSquared) * t * t +
                        8 * (x1 * x1 * bSquared + y1 * y1 * aSquared) * t;
                };
                // we need an upper bound for the change in t so the newton's method terminates
                // the length of the bezier-curve is smaller or equal than the length of the lines connecting the
                // curve's points. So every pixel has a maximum t-range of 1/(length between points).
                // Since we don't care if the result is one or two pixels off (and the bezier curve is usually shorter
                // than this distance), we take the double of this.
                var bound = 2 / (Math.abs(x1 * x2 + y1 * y1) + Math.abs(x2 * x2 + y2 * y2)), t_n1;
                // calculate newton's method
                // we do not want this to be an infinite loop, so we set a maximum number of iterations
                for (var n = 0; n < MAXIMUM_STEPS; n++) {
                    t_n1 = t_n;
                    t_n = t_n1 - f(t_n1) / df_dt(t_n1);
                    if (Math.abs(t_n1 - t_n) < bound) {
                        break;
                    }
                }
            }
            // derivative of the curve in the resulting point
            // straight-forward derivation of the functions x_t and y_t
            var derivative = [x2Minus2x1 * t_n + x1, y2Minus2y1 * t_n + y1];
            var x_i = this.endNode.getX() + x_t(t_n), y_i = this.endNode.getY() + y_t(t_n);
            // the final result
            this.interjectionPoint = [x_i, y_i, derivative[0], derivative[1]];
        };
        /**
         * Get the interjection-point of the bezier-curve associated with this edge and the ellipse associated with
         * the end-node - this is the point the arrow points to
         * @returns {*[]}
         */
        Edge.prototype.getInterjectionPoint = function () {
            return [this.interjectionPoint[0], this.interjectionPoint[1]];
        };
        /**
         * Get the interjection-angle of the bezier-curve associated with this edge and the ellipse associated with
         * the end-node
         * @returns {number}
         */
        Edge.prototype.getInterjectionAngle = function () {
            return 180 * Math.atan2(this.interjectionPoint[3], this.interjectionPoint[2]) / Math.PI;
        };
        return Edge;
    }());
    sparql.Edge = Edge;
    var Node = /** @class */ (function () {
        /**
         * Set up a new node
         * @param name
         * @param type
         */
        function Node(name, type) {
            if (type === void 0) { type = NodeType.REGULAR; }
            /**
             * A list of all sub-graphs this node belongs to
             */
            this.subGraphList = [];
            /**
             * A list of all edges that are connected to this node
             * @type {Array}
             */
            this.edgeList = [];
            /**
             * A list of all filters this node belongs to
             * @type {Array}
             */
            this.filterList = [];
            /**
             * A list of all binds this node belongs to
             * @type {Array}
             */
            this.bindList = [];
            /**
             * A list of all unions this node belongs to
             * @type {Array}
             */
            this.unionList = [];
            /**
             * A list of all order-by-statements this node belongs to
             * @type {Array}
             */
            this.orderList = [];
            /**
             * A list of all services this node belongs to
             * @type {Array}
             */
            this.serviceList = [];
            /**
             * The ellipse-parameter a so that x^2 / a^2 + y^2 / b^2 = 1
             */
            this.rx = 20;
            /**
             * The ellipse-parameter b so that x^2 / a^2 + y^2 / b^2 = 1
             */
            this.ry = 10;
            this.fixed = false;
            this.name = name;
            this.type = type;
        }
        /**
         * Get the node's name
         * @returns {string}
         */
        Node.prototype.getName = function () {
            return this.name;
        };
        /**
         * Get the node's type
         * @returns {NodeType}
         */
        Node.prototype.getType = function () {
            return this.type;
        };
        /**
         * Set the node's type
         * @param type
         * @returns {sparql.Node}
         */
        Node.prototype.setType = function (type) {
            this.type = type;
            return this;
        };
        Node.prototype.isSelect = function () {
            return this.type === NodeType.SELECT;
        };
        /**
         * Get all sub-graphs this node belongs to
         * @returns {SubGraph[]}
         */
        Node.prototype.getSubGraphList = function () {
            return this.subGraphList;
        };
        /**
         * Add a sub-graph this node belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param subGraph
         * @returns {sparql.Node}
         */
        Node.prototype.addSubGraph = function (subGraph) {
            this.subGraphList.push(subGraph);
            subGraph.addNode(this);
            return this;
        };
        /**
         * Get all edges that are connected to this node
         * @returns {Edge[]}
         */
        Node.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add an edge that is connected to this node
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param edge
         * @returns {sparql.Node}
         */
        Node.prototype.addEdge = function (edge) {
            this.edgeList.push(edge);
            return this;
        };
        /**
         * Get all filters this node belongs to
         * @returns {Filter[]}
         */
        Node.prototype.getFilterList = function () {
            return this.filterList;
        };
        /**
         * Add a filter that this node belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param filter
         * @returns {sparql.Node}
         */
        Node.prototype.addFilter = function (filter) {
            this.filterList.push(filter);
            return this;
        };
        /**
         * Get all binds this node belongs to
         * @returns {Bind[]}
         */
        Node.prototype.getBindList = function () {
            return this.bindList;
        };
        /**
         * Add a filter that this node belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param bind
         * @returns {sparql.Node}
         */
        Node.prototype.addBind = function (bind) {
            this.bindList.push(bind);
            return this;
        };
        /**
         * Get all unions this node belongs to
         * @returns {Union[]}
         */
        Node.prototype.getUnionList = function () {
            return this.unionList;
        };
        /**
         * Add a union that this node belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param union
         * @returns {sparql.Node}
         */
        Node.prototype.addUnion = function (union) {
            for (var u in this.unionList) {
                if (u === union.toString()) {
                    return this;
                }
            }
            this.unionList.push(union);
            return this;
        };
        /**
         * Get all unions this node belongs to
         * @returns {Order[]}
         */
        Node.prototype.getOrderList = function () {
            return this.orderList;
        };
        /**
         * Add a order-by-statement that this node belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param order
         * @returns {sparql.Node}
         */
        Node.prototype.addOrder = function (order) {
            this.orderList.push(order);
            return this;
        };
        /**
         * Get all services this node belongs to
         * @returns {Service[]}
         */
        Node.prototype.getServiceList = function () {
            return this.serviceList;
        };
        /**
         * Add a service that this node belongs to
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param service
         * @returns {sparql.Node}
         */
        Node.prototype.addService = function (service) {
            this.serviceList.push(service);
            service.addNode(this);
            return this;
        };
        /**
         * Get x-position
         * @returns {number}
         */
        Node.prototype.getX = function () {
            return this.x;
        };
        /**
         * Get y-position
         * @returns {number}
         */
        Node.prototype.getY = function () {
            return this.y;
        };
        /**
         * Get the ellipse-parameter a with x^2 / a^2 + y^2 / b^2 = 1
         * @returns {number}
         */
        Node.prototype.getEllipseParameterX = function () {
            return this.rx * 0.6;
        };
        /**
         * Get the ellipse-parameter b with x^2 / a^2 + y^2 / b^2 = 1
         * @returns {number}
         */
        Node.prototype.getEllipseParameterY = function () {
            return this.ry * 0.9;
        };
        return Node;
    }());
    sparql.Node = Node;
    var SubGraph = /** @class */ (function () {
        /**
         * Set up a new sub-graph
         * @param name
         */
        function SubGraph(name) {
            /**
             * A list of all nodes that are inside this sub-graph
             * @type {Array}
             */
            this.nodeList = [];
            /**
             * A list of all edges that are inside this sub-graph
             * @type {Array}
             */
            this.edgeList = [];
            this.name = name;
        }
        /**
         * Get the sub-graph's name
         * @returns {string}
         */
        SubGraph.prototype.getName = function () {
            return this.name;
        };
        /**
         * Get all nodes that are inside this sub-graph
         * @returns {Node[]}
         */
        SubGraph.prototype.getNodeList = function () {
            return this.nodeList;
        };
        /**
         * Add a node to this sub-graph
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param node
         * @returns {SubGraph}
         */
        SubGraph.prototype.addNode = function (node) {
            for (var _i = 0, _a = this.nodeList; _i < _a.length; _i++) {
                var containingNode = _a[_i];
                if (containingNode === node) {
                    return this;
                }
            }
            this.nodeList.push(node);
            return this;
        };
        /**
         * Get all edges that are inside this sub-graph
         * @returns {Edge[]}
         */
        SubGraph.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add an edge to this sub-graph
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param edge
         * @returns {SubGraph}
         */
        SubGraph.prototype.addEdge = function (edge) {
            for (var _i = 0, _a = this.edgeList; _i < _a.length; _i++) {
                var containingEdge = _a[_i];
                if (containingEdge === edge) {
                    return this;
                }
            }
            this.edgeList.push(edge);
            return this;
        };
        return SubGraph;
    }());
    sparql.SubGraph = SubGraph;
    var Service = /** @class */ (function () {
        /**
         * Set up a new service
         * @param name
         */
        function Service(name) {
            /**
             * A list of all nodes that are inside this service
             * @type {Array}
             */
            this.nodeList = [];
            /**
             * A list of all edges that are inside this service
             * @type {Array}
             */
            this.edgeList = [];
            this.name = name;
        }
        /**
         * Get the service's name
         * @returns {string}
         */
        Service.prototype.getName = function () {
            return this.name;
        };
        /**
         * Get all nodes that are inside this service
         * @returns {Node[]}
         */
        Service.prototype.getNodeList = function () {
            return this.nodeList;
        };
        /**
         * Add a node to this service
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param node
         * @returns {SubGraph}
         */
        Service.prototype.addNode = function (node) {
            for (var _i = 0, _a = this.nodeList; _i < _a.length; _i++) {
                var containingNode = _a[_i];
                if (containingNode === node) {
                    return this;
                }
            }
            this.nodeList.push(node);
            return this;
        };
        /**
         * Get all edges that are inside this service
         * @returns {Edge[]}
         */
        Service.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add an edge to this service
         * NOTE: Usually you would not call this function manually!
         * Returns this for a fluent interface
         * @param edge
         * @returns {SubGraph}
         */
        Service.prototype.addEdge = function (edge) {
            for (var _i = 0, _a = this.edgeList; _i < _a.length; _i++) {
                var containingEdge = _a[_i];
                if (containingEdge === edge) {
                    return this;
                }
            }
            this.edgeList.push(edge);
            return this;
        };
        return Service;
    }());
    sparql.Service = Service;
    var Union = /** @class */ (function () {
        /**
         * Set up a new union
         * @param name
         */
        function Union(name) {
            /**
             * A list of all edges that belong to this union
             * @type {Array}
             */
            this.edgeList = [];
            this.name = name;
        }
        /**
         * Get the union's name
         * @returns {string}
         */
        Union.prototype.getName = function () {
            return this.name;
        };
        /**
         * Get all edges that belong to this union
         * @returns {Edge[]}
         */
        Union.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add a new edge to this union
         * @param edge
         * @returns {Union}
         */
        Union.prototype.addEdge = function (edge) {
            this.edgeList.push(edge);
            edge.addUnion(this);
            return this;
        };
        return Union;
    }());
    sparql.Union = Union;
    var Filter = /** @class */ (function () {
        /**
         * Set up a new filter
         * @param text
         */
        function Filter(text) {
            /**
             * A list of all edges that belong to this filter
             * @type {Array}
             */
            this.edgeList = [];
            /**
             * A list of all nodes that belong to this filter
             * @type {Array}
             */
            this.nodeList = [];
            this.text = text;
        }
        /**
         * Get the textual representation of this filter
         * @returns {string}
         */
        Filter.prototype.getText = function () {
            return this.text;
        };
        /**
         * Get all edges that belong to this filter
         * @returns {Edge[]}
         */
        Filter.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add a new edge to this filter
         * @param edges
         * @returns {Filter}
         */
        Filter.prototype.addEdge = function (edges) {
            for (var _i = 0, edges_1 = edges; _i < edges_1.length; _i++) {
                var edge = edges_1[_i];
                this.edgeList.push(edge);
                edge.addFilter(this);
            }
            return this;
        };
        /**
         * Get all nodes that belong to this filter
         * @returns {Node[]}
         */
        Filter.prototype.getNodeList = function () {
            return this.nodeList;
        };
        /**
         * Add a new node to this filter
         * @param node
         * @returns {Filter}
         */
        Filter.prototype.addNode = function (node) {
            if (node !== null) {
                this.nodeList.push(node);
                node.addFilter(this);
            }
            return this;
        };
        return Filter;
    }());
    sparql.Filter = Filter;
    var Bind = /** @class */ (function () {
        /**
         * Set up a new bind
         * @param text
         */
        function Bind(text) {
            /**
             * A list of all edges that belong to this bind
             * @type {Array}
             */
            this.edgeList = [];
            /**
             * A list of all nodes that belong to this bind
             * @type {Array}
             */
            this.nodeList = [];
            this.text = text;
        }
        /**
         * Get the textual representation of this bind
         * @returns {string}
         */
        Bind.prototype.getText = function () {
            return this.text;
        };
        /**
         * Get all edges that belong to this bind
         * @returns {Edge[]}
         */
        Bind.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add a new edge to this bind
         * @param edges
         * @returns {Filter}
         */
        Bind.prototype.addEdge = function (edges) {
            for (var _i = 0, edges_2 = edges; _i < edges_2.length; _i++) {
                var edge = edges_2[_i];
                this.edgeList.push(edge);
                edge.addBind(this);
            }
            return this;
        };
        /**
         * Get all nodes that belong to this bind
         * @returns {Node[]}
         */
        Bind.prototype.getNodeList = function () {
            return this.nodeList;
        };
        /**
         * Add a new node to this bind
         * @param node
         * @returns {Filter}
         */
        Bind.prototype.addNode = function (node) {
            if (node !== null) {
                this.nodeList.push(node);
                node.addBind(this);
            }
            return this;
        };
        return Bind;
    }());
    sparql.Bind = Bind;
    var Order = /** @class */ (function () {
        function Order() {
            /**
             * A list of all edges that belong to this order
             * @type {Array}
             */
            this.edgeList = [];
            /**
             * A list of all nodes that belong to this order
             * @type {Array}
             */
            this.nodeList = [];
        }
        Order.prototype.getText = function () {
            var text = [];
            for (var _i = 0, _a = this.edgeList; _i < _a.length; _i++) {
                var edge = _a[_i];
                text.push(edge.getName());
            }
            for (var _b = 0, _c = this.nodeList; _b < _c.length; _b++) {
                var node = _c[_b];
                text.push(node.getName());
            }
            return text.join(', ');
        };
        /**
         * Get all edges that belong to this order
         * @returns {Edge[]}
         */
        Order.prototype.getEdgeList = function () {
            return this.edgeList;
        };
        /**
         * Add a new edge to this order
         * @param edge
         * @returns {Filter}
         */
        Order.prototype.addEdge = function (edge) {
            this.edgeList.push(edge);
            edge.addOrder(this);
            return this;
        };
        /**
         * Get all nodes that belong to this order
         * @returns {Node[]}
         */
        Order.prototype.getNodeList = function () {
            return this.nodeList;
        };
        /**
         * Add a new node to this order
         * @param node
         * @returns {Filter}
         */
        Order.prototype.addNode = function (node) {
            this.nodeList.push(node);
            node.addOrder(this);
            return this;
        };
        return Order;
    }());
    sparql.Order = Order;
})(sparql || (sparql = {}));

app.controller("visualisationController", function ($scope, highlightingService, dragNodeService, parseQueryService, $location, queryLogService) {
    $scope.nodes = [];
    $scope.edges = [];
    $scope.subGraphs = [];
    $scope.filters = [];
    $scope.binds = [];
    $scope.unions = [];
    $scope.orders = [];
    $scope.services = [];
    $scope.limit = Infinity;
    $scope.queries = queryLogService.receivedQueries;
    $scope.selectedQuery = queryLogService.selectedQuery.queryString;
    $scope.truncateLength = 250;

    $scope.update = function () {
        parseQueryService.parse(queryLogService.selectedQuery.queryString);
    };

    $scope.$watch("parseQueryService.getObject()", function (newQuery) {
        if (newQuery === null)
            return;
        $scope.nodes = newQuery.getNodeList();
        $scope.edges = newQuery.getEdgeList();
        $scope.subGraphs = newQuery.getSubGraphList();
        $scope.filters = newQuery.getFilterList();
        $scope.binds = newQuery.getBindList();
        $scope.unions = newQuery.getUnionList();
        $scope.orders = [newQuery.getOrder()];
        $scope.services = newQuery.getServiceList();
        $scope.limit = newQuery.getLimit();
        if ($scope.orders[0] === null) {
            $scope.orders = [];
        }
        var numberOfNodes = $scope.nodes.length;
        var source, target, numberOfLinksList = new Array(numberOfNodes * numberOfNodes);
        // Stores the number of links between two nodes
        for (var numberOfLinks = 0; numberOfLinks < numberOfLinksList.length; numberOfLinks++) {
            numberOfLinksList[numberOfLinks] = 0;
        }
        for (var _i = 0, _a = $scope.edges; _i < _a.length; _i++) {
            var edge = _a[_i];
            for (var nodeId in $scope.nodes) {
                if (!$scope.nodes.hasOwnProperty(nodeId))
                    continue;
                if ($scope.nodes[nodeId] == edge.getStartNode()) {
                    source = parseInt(nodeId);
                }
                else if ($scope.nodes[nodeId] == edge.getEndNode()) {
                    target = parseInt(nodeId);
                }
            }
            edge.source = source;
            edge.target = target;
            // For the graph with n nodes, the number of nodes connecting node k and node j (with k <= j) the position is stored on
            // position k * n + j
            var posInList = Math.min(target, source) * numberOfNodes + Math.max(target, source);
            if (numberOfLinksList[posInList] === 1) {
                edge.setType(sparql.GraphEdgeType.BEZIER_POSITIVE);
            }
            else if (numberOfLinksList[posInList] > 0) {
                edge.setType(sparql.GraphEdgeType.BEZIER_NEGATIVE);
            }
            numberOfLinksList[posInList]++;
        }
        $scope.graphSize = { width: 900, height: 600 };
        var force = d3.forceSimulation()
            .nodes($scope.nodes)
            .force("center", d3.forceCenter($scope.graphSize.width / 2, $scope.graphSize.height / 2))
            .force("charge", d3.forceManyBody().strength(-1))
            .force("collide", d3.forceCollide().radius(100))
            .force("link", d3.forceLink($scope.edges).strength(0.2))
            .on("tick", ticked)
            .on("end", function () { console.log("simulation finished", $scope.edges, this.nodes()); });
        ;
        function ticked() {
            //console.log("tick", $scope.nodes, $scope.edges)
            for (var _i = 0, _a = $scope.edges; _i < _a.length; _i++) {
                var e = _a[_i];
                e.updateCenterPoint();
                e.updateInterjectionPoint();
            }
            $scope.$apply();
        }
        //dragNodeService.setForceLayout(force);
    });
    $scope.highlightService = highlightingService;
    $scope.dragNodeService = dragNodeService;
    $scope.parseQueryService = parseQueryService;
    $scope.queryLogService = queryLogService;
    $scope.$location = $location;

    $scope.update();
});

/// <reference path="../../node_modules/@types/jquery/index.d.ts" />
/// <reference path="../../node_modules/@types/angular/index.d.ts" />
app.directive("node", function () {
    return {
        restrict: 'A',
        scope: {
            'node': '=',
            'highlight': '='
        },
        templateUrl: 'pages/node.html',
        link: function (scope, element) {
            var textElement = element.find('text')[0];
            scope.$watch('node.name', function (newSize, oldSize, scope) {
                var boundingRect = textElement.getBoundingClientRect();
                scope.node.rx = Math.round(boundingRect.width);
                scope.node.ry = Math.round(boundingRect.height);
            });
        }
    };
});
app.directive("edge", function () {
    return {
        'restrict': 'A',
        'scope': {
            'edge': '=',
            'highlight': '='
        },
        templateUrl: 'pages/edge.html',
        'link': function (scope, element) {
            var textElement = element.find('text')[0];
            scope.$watch('edge.text', function (newSize, oldSize, scope) {
                var boundingRect = textElement.getBoundingClientRect();
                scope.edge.size.x = Math.round(boundingRect.width);
                scope.edge.size.y = Math.round(boundingRect.height);
            });
        }
    };
});

// https://www.html5rocks.com/en/tutorials/frameworks/angular-websockets/

app.factory('highlightingService', [function () {
        var highlightedSubGraph = null, highlightedFilter = null, highlightedBind = null, highlightedUnion = null, highlightedOrder = null, highlightedService = null;
        return {
            highlight: function (object) {
                if (object instanceof sparql.SubGraph) {
                    highlightedSubGraph = object;
                }
                else if (object instanceof sparql.Filter) {
                    highlightedFilter = object;
                }
                else if (object instanceof sparql.Bind) {
                    highlightedBind = object;
                }
                else if (object instanceof sparql.Union) {
                    highlightedUnion = object;
                }
                else if (object instanceof sparql.Order) {
                    highlightedOrder = object;
                }
                else if (object instanceof sparql.Service) {
                    highlightedService = object;
                }
                else {
                    highlightedSubGraph = highlightedFilter = highlightedBind = highlightedUnion = highlightedOrder = highlightedService = null;
                }
            },
            isHighlighted: function (object) {
                if (highlightedSubGraph === null && highlightedFilter === null &&
                    highlightedBind === null && highlightedUnion === null &&
                    highlightedOrder === null && highlightedService === null) {
                    return true;
                }
                else if (object instanceof sparql.SubGraph) {
                    return highlightedSubGraph === object;
                }
                else if (object instanceof sparql.Filter) {
                    return highlightedFilter === object;
                }
                else if (object instanceof sparql.Bind) {
                    return highlightedBind === object;
                }
                else if (object instanceof sparql.Union) {
                    return highlightedUnion === object;
                }
                else if (object instanceof sparql.Order) {
                    return highlightedOrder === object;
                }
                else if (object instanceof sparql.Service) {
                    return highlightedService === object;
                }
                else if (object instanceof sparql.Node) {
                    return $.inArray(highlightedSubGraph, object.getSubGraphList()) >= 0 ||
                        $.inArray(highlightedFilter, object.getFilterList()) >= 0 ||
                        $.inArray(highlightedBind, object.getBindList()) >= 0 ||
                        $.inArray(highlightedUnion, object.getUnionList()) >= 0 ||
                        $.inArray(highlightedOrder, object.getOrderList()) >= 0 ||
                        $.inArray(highlightedService, object.getServiceList()) >= 0;
                }
                else if (object instanceof sparql.Edge) {
                    return (highlightedSubGraph === object.getSubgraph() && object.getSubgraph() !== null) ||
                        (highlightedService === object.getService() && object.getService() !== null) ||
                        $.inArray(highlightedFilter, object.getFilterList()) >= 0 ||
                        $.inArray(highlightedBind, object.getBindList()) >= 0 ||
                        $.inArray(highlightedUnion, object.getUnionList()) >= 0 ||
                        $.inArray(highlightedOrder, object.getOrderList()) >= 0;
                }
                return false;
            }
        };
    }]).factory('dragNodeService', [function () {
        var forceLayout;
        var dragNode = null, positionOnStart = [0, 0], position = [0, 0];
        return {
            setForceLayout: function (force) {
                forceLayout = force;
            },
            dragNode: function (node, event) {
                if (node !== null) {
                    positionOnStart[0] = node.x;
                    positionOnStart[1] = node.y;
                    position[0] = event.pageX;
                    position[1] = event.pageY;
                }
                dragNode = node;
            },
            moveNode: function (event) {
                if (dragNode !== null) {
                    dragNode.x = positionOnStart[0] + event.pageX - position[0];
                    dragNode.y = positionOnStart[1] + event.pageY - position[1];
                }
            }
        };
    }]);
var GraphicalSparql;
(function (GraphicalSparql_1) {
    /**
     * Hauptklasse
     * ist für das binding an die Umgebung gedacht
     */
    var GraphicalSparql = /** @class */ (function () {
        function GraphicalSparql(svgElement) {
        }
        GraphicalSparql.prototype.bindTextarea = function (textArea, button, typingDelay) {
            if (typingDelay === void 0) { typingDelay = Infinity; }
        };
        return GraphicalSparql;
    }());
    /**
     * Analysiert die Query und erzeugt den Graphen
     */
    var QueryAnalyzer = /** @class */ (function () {
        function QueryAnalyzer(visualizer) {
        }
        QueryAnalyzer.prototype.analizeQuery = function (text) { };
        return QueryAnalyzer;
    }());
    /**
     * Nimmt das Analyseergebnis und stellt es in dem SVG-Element dar
     */
    var QueryVisualizer = /** @class */ (function () {
        function QueryVisualizer(svgElement) {
        }
        return QueryVisualizer;
    }());
    /**
     * Ein SPARQL-Graph
     * Nodes im Graphen (dies können wiederum auch Subgrahen sein) werden ungeordent gespeichert.
     * Verbindungen zwischen den Nodes werden im Node selbst gespeichert. Dies vereinfacht die Darstellungsberechnung
     */
    var SparqlGraph = /** @class */ (function () {
        function SparqlGraph(label) {
            if (label === void 0) { label = ''; }
        }
        SparqlGraph.prototype.addNode = function (node) { };
        return SparqlGraph;
    }());
    /**
     * Ein Node des Graphen
     * Dies kann entweder ein Subjekt oder ein Objekt sein
     */
    var SparqlNode = /** @class */ (function () {
        function SparqlNode(label) {
        }
        SparqlNode.prototype.setFrom = function (connector) { };
        SparqlNode.prototype.addTo = function (connector) { };
        return SparqlNode;
    }());
    /**
     * Repräsentiert das Prädikat des Tripels
     */
    var SparqlNodeConnection = /** @class */ (function () {
        function SparqlNodeConnection(label, from, to) {
        }
        return SparqlNodeConnection;
    }());
})(GraphicalSparql || (GraphicalSparql = {}));
/// <reference path="../../node_modules/@types/jquery/index.d.ts" />
/// <reference path="../../node_modules/@types/angular/index.d.ts" />
/// <reference path="../../node_modules/@types/d3/index.d.ts" />
/// <reference path="../sparql-js/sparqljs.d.ts" />
/// <reference path="../graphicalSPARQL/classes.ts" />
app.factory('parseQueryService', [function () {
        var parser = sparqljs.Parser();
        var generator = sparqljs.Generator();
        console.log(generator);
        var query = null;
        var objectify = function (queryJson) {
            var object = new sparql.Query();
            var nodes = [];
            var subGraphs = [];
            function getGraph(name) {
                if (!subGraphs.hasOwnProperty(name)) {
                    subGraphs[name] = new sparql.SubGraph(name);
                    object.addSubGraph(subGraphs[name]);
                }
                return subGraphs[name];
            }
            function getNode(name, force) {
                if (force === void 0) { force = true; }
                if (!nodes.hasOwnProperty(name) && force) {
                    nodes[name] = new sparql.Node(killPrefixes(name));
                    object.addNode(nodes[name]);
                }
                return nodes[name] || null;
            }
            function getEdges(name) {
                var edges = [];
                for (var _i = 0, _a = object.getEdgeList(); _i < _a.length; _i++) {
                    var edge = _a[_i];
                    if (edge.getName() === name) {
                        edges.push(edge);
                    }
                }
                return edges;
            }
            var killPrefixes = function (string) {
                if (string === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
                    // this is a special predicate
                    return "a";
                }
                else if (string.indexOf('http://www.w3.org/2001/XMLSchema#boolean') !== -1) {
                    // booleans
                    return string.substr(1, string.indexOf('"', 1) - 1);
                }
                var prefixes = queryJson.prefixes;
                for (var prefix in prefixes) {
                    if (!prefixes.hasOwnProperty(prefix))
                        continue;
                    if (string.indexOf(prefixes[prefix]) === 0) {
                        return string.replace(prefixes[prefix], prefix + ':');
                    }
                }
                return string;
            };
            var addTriple = function (triples, type, graph, service, union) {
                if (type === void 0) { type = sparql.EdgeType.REGULAR; }
                if (graph === void 0) { graph = null; }
                if (service === void 0) { service = null; }
                if (union === void 0) { union = null; }
                for (var _i = 0, triples_1 = triples; _i < triples_1.length; _i++) {
                    var triple = triples_1[_i];
                    if (typeof triple.predicate === "object") {
                        if (triple.predicate.type === "path") {
                            triple.predicate = triple.predicate.items.join(triple.predicate.pathType) + '*';
                        }
                    }
                    var edge = new sparql.Edge(killPrefixes(triple.predicate), getNode(triple.subject), getNode(triple.object), type, graph, service);
                    if (union !== null) {
                        union.addEdge(edge);
                    }
                    object.addEdge(edge);
                }
            }, addEdge = function (pattern, type, service, union) {
                if (type === void 0) { type = sparql.EdgeType.REGULAR; }
                if (service === void 0) { service = null; }
                if (union === void 0) { union = null; }
                var graph = null;
                if (pattern.type === "graph") {
                    graph = getGraph(pattern.name);
                }
                // if pattern.type === "bgp", graph is just null…
                addTriple(pattern.triples, type, graph, service, union);
            }, addEdges = function (patterns, type, service) {
                if (type === void 0) { type = sparql.EdgeType.REGULAR; }
                if (service === void 0) { service = null; }
                for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
                    var pattern = patterns_1[_i];
                    addEdge(pattern, type, service);
                }
            }, addWhereClause = function (where, type, service, union) {
                if (type === void 0) { type = sparql.EdgeType.REGULAR; }
                if (service === void 0) { service = null; }
                if (union === void 0) { union = null; }
                for (var _i = 0, where_1 = where; _i < where_1.length; _i++) {
                    var updateWhereClause = where_1[_i];
                    var where_2 = updateWhereClause;
                    var pattern = updateWhereClause;
                    switch (updateWhereClause.type) {
                        case "group":
                            addWhereClause(where_2.patterns, type, service, union);
                            break;
                        case "graph":
                            updateWhereClause['triples'] = where_2.patterns[0].triples;
                        case "bgp":
                            addEdge(updateWhereClause, type, service, union);
                            break;
                        case "minus":
                            addWhereClause(where_2.patterns, sparql.EdgeType.MINUS, service, union);
                            break;
                        case "optional":
                            addWhereClause(where_2.patterns, sparql.EdgeType.OPTIONAL, service, union);
                            break;
                        case "service":
                            var newService = new sparql.Service(updateWhereClause.name);
                            addWhereClause(where_2.patterns, type, newService, union);
                            object.addService(newService);
                            break;
                        case "union":
                            var newUnion = new sparql.Union("U" + (object.getUnionList().length + 1));
                            object.addUnion(newUnion);
                            addWhereClause(where_2.patterns, type, service, newUnion);
                            break;
                        case "bind":
                            var bind = new sparql.Bind(generator.toPattern(updateWhereClause));
                            bind.addNode(getNode(pattern.variable, false));
                            bind.addEdge(getEdges(pattern.variable));
                            if (typeof pattern.expression === "string") {
                                bind.addNode(getNode(pattern.expression, false));
                                bind.addEdge(getEdges(pattern.expression));
                            }
                            else {
                                for (var _a = 0, _b = pattern.expression.args; _a < _b.length; _a++) {
                                    var bindArg = _b[_a];
                                    bind.addNode(getNode(bindArg, false));
                                    bind.addEdge(getEdges(bindArg));
                                }
                            }
                            object.addBind(bind);
                            break;
                        case "filter":
                            console.log(generator);
                            var str = generator.toPattern(pattern);
                            console.log("str", str);
                            var filter = new sparql.Filter(str);
                            for (var _c = 0, _d = pattern.expression.args; _c < _d.length; _c++) {
                                var filterArg = _d[_c];
                                if (typeof filterArg === "object") {
                                    if (filterArg.hasOwnProperty('args')) {
                                        for (var _e = 0, _f = filterArg.args; _e < _f.length; _e++) {
                                            var subFilterArg = _f[_e];
                                            filter.addNode(getNode(subFilterArg, false));
                                            filter.addEdge(getEdges(subFilterArg));
                                        }
                                    }
                                    else if (filterArg.hasOwnProperty('triples')) {
                                        for (var _g = 0, _h = filterArg.triples; _g < _h.length; _g++) {
                                            var filterTriple = _h[_g];
                                            var edges = getEdges(filterTriple.predicate);
                                            if (edges.length === 0) {
                                                addTriple([filterTriple], type, null, service, union);
                                            }
                                            filter.addNode(getNode(filterTriple.subject));
                                            filter.addNode(getNode(filterTriple.object));
                                            filter.addEdge(getEdges(filterTriple.predicate));
                                        }
                                    }
                                }
                                else {
                                    filter.addNode(getNode(filterArg, false));
                                    filter.addEdge(getEdges(filterArg));
                                }
                            }
                            object.addFilter(filter);
                    }
                }
            };
            var where;
            if (queryJson.type === "update") {
                // insert or delete
                addEdges(queryJson.updates[0].insert, sparql.EdgeType.INSERT);
                if (queryJson.updates[0].hasOwnProperty('delete')) {
                    addEdges(queryJson.updates[0]["delete"], sparql.EdgeType.DELETE);
                }
                where = queryJson.updates[0].where || [];
            }
            else if (queryJson.type === "query") {
                if (queryJson.queryType === 'CONSTRUCT') {
                    addTriple(queryJson.template, sparql.EdgeType.CONSTRUCT);
                }
                where = queryJson.where;
            }
            addWhereClause(where);
            if (queryJson.type === "query" && queryJson.queryType === "SELECT") {
                if (queryJson.variables.length === 1 && queryJson.variables[0] === "*") {
                    for (var _i = 0, _a = object.getNodeList(); _i < _a.length; _i++) {
                        var node = _a[_i];
                        node.setType(sparql.NodeType.SELECT);
                    }
                }
                for (var _b = 0, _c = queryJson.variables; _b < _c.length; _b++) {
                    var selectVariable = _c[_b];
                    if (nodes.hasOwnProperty(selectVariable)) {
                        nodes[selectVariable].setType(sparql.NodeType.SELECT);
                    }
                }
            }
            if (queryJson.hasOwnProperty('limit')) {
                object.setLimit(queryJson.limit);
            }
            if (queryJson.hasOwnProperty('order')) {
                var order = new sparql.Order();
                for (var _d = 0, _e = queryJson.order; _d < _e.length; _d++) {
                    var expression = _e[_d];
                    if (nodes.hasOwnProperty(expression.expression)) {
                        order.addNode(nodes[expression.expression]);
                    }
                }
                object.setOrder(order);
            }
            return object;
        };
        return {
            parse: function (newQuery) {
                if (newQuery !== undefined) {
                    try {
                        var query_ext = "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \n" +
                            "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n" +
                            "PREFIX owl: <http://www.w3.org/2002/07/owl#> \n" + newQuery;
                        query = objectify(parser.parse(query_ext));
                    }
                    catch (e) {
                        alert(e);
                    }
                }
            },
            getObject: function () {
                return query;
            }
        };
    }]);
/**
 * Created by mgraube on 23.05.17.
 */
