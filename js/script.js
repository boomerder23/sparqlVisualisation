var app = angular.module('sparqlVisualiser', ['ngRoute', 'ui.bootstrap']);

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

	queryLogServiceObject.getQueriesFromProxy = function (){
    	queryLogServiceObject.receivedQueries = [];
    	$http.get('http://localhost:5060').then(processReceivedQueries);	
    };

    function processReceivedQueries(queries){
		queries.data.forEach(function (query){
			var newQuery = new Object();
			newQuery.date = query.time;
			newQuery.status = "Status";
			newQuery.coreQuery = query.query;
			newQuery.keywordString = extractKeywords(query.query);
			newQuery.url = query.url;
			queryLogServiceObject.receivedQueries.push(newQuery);

		});
	};

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


app.controller('queryLogController', function($scope, $http, queryLogService) {
	
	//link data to view
    $scope.receivedQueries = queryLogService.receivedQueries;

    //get Queries when page is loaded, so that is not empty
    queryLogService.getQueriesFromProxy();
    
    $scope.refreshQueries = function(){
		console.log('inside refreshQueries');
		queryLogService.getQueriesFromProxy();
    };
	

	//show Query of log Entry
	$scope.showQuery = function(query) {
		console.log('inside showQuery');
		console.log(query.time);
		$scope.coreQuery = query;
	};	
	
});

app.controller('visualisationController', function($scope) {
	$scope.message = 'Iam the Visualisation Page';
});

app.controller('resultsController', function($scope) {
	$scope.message = 'Iam the Results Page';
});

app.controller('debuggingController', function($scope) {
	$scope.message = 'Iam the Results Page';
});