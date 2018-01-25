var app = angular.module('sparqlVisualiser', ['ngRoute', 'ui.bootstrap', 'ngclipboard']);

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


app.factory('queryLogService',function ($http) {
	var queryLogServiceObject = {};
	queryLogServiceObject.receivedQueries = [];
	queryLogServiceObject.selectedQuery = {};

	queryLogServiceObject.getQueriesFromProxy = function (){
    	queryLogServiceObject.receivedQueries = [];
    	$http.get('http://localhost:5060').then(processReceivedQueries);	
    };

    function processReceivedQueries(queries){
    	var	 id = 1;
		queries.data.forEach(function (query){
			var newQuery = new Object();
			newQuery.id = id;
			newQuery.date = query.time;
			newQuery.status = "Status";			
			newQuery.url = query.url;
			newQuery.client = query.client;
			newQuery.userAgent = query.userAgent;
			// extract information from inside the query
			newQuery.queryString = query.query;
			newQuery.prefixes = extractPrefixes(query.query);
			newQuery.coreQuery = extractCoreQuery(query.query);
			newQuery.keywordString = extractKeywords(query.query);

			queryLogServiceObject.receivedQueries.push(newQuery);

			id++;
		});
		queryLogServiceObject.selectedQuery = queryLogServiceObject.receivedQueries[0];
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

	return queryLogServiceObject;
});


app.controller('queryLogController', function($scope, $http, $location, queryLogService) {
	
	//link data to view
    $scope.receivedQueries = queryLogService.receivedQueries;

    //get Queries when page is loaded, so that is not empty
    queryLogService.getQueriesFromProxy();
    
    //link refresh function to view
    $scope.refreshQueries = function(){
		console.log('inside refreshQueries');
		queryLogService.getQueriesFromProxy();
    };
	
	$scope.setSelection = function(query) {
		$scope.selectedQueryId = query.id;
		$scope.fullQuery = query.queryString;
	};

	$scope.openVisualisation = function(query){
		console.log('inside openVisualisation');
		queryLogService.selectedQuery = query;
		$location.path('visualisation');
	};

	$scope.openResults = function(query){
		console.log('inside openVisualisation');
		$location.path('results');
	};

	$scope.openDebugging = function(query){
		console.log('inside openVisualisation');
		$location.path('debugging');
	};
	
});

app.controller('visualisationController', function($scope, queryLogService) {
	console.log('inside visual controller');
	$scope.query = queryLogService.selectedQuery;
});

app.controller('resultsController', function($scope) {
	$scope.message = 'Iam the Results Page';
});

app.controller('debuggingController', function($scope) {
	$scope.message = 'Iam the Results Page';
});