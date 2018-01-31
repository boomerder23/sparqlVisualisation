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

app.controller('visualisationController', function($scope, queryLogService) {
	console.log('inside visual controller');
	$scope.query = queryLogService.selectedQuery;
});

app.controller('resultsController', function($scope, $http, queryLogService) {

	//announce the Service to the scope
	$scope.queryLogService = queryLogService;

	$scope.getResults = function () {
		$scope.queryLogService.getResultsFromQuery($scope.queryLogService.selectedQuery);
	}

	//get results after startup
	$scope.getResults();

});

app.controller('debuggingController', function($scope) {
	$scope.message = 'Iam the Results Page';
});