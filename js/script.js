var app = angular.module('sparqlVisualiser', ['ngRoute']);

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


app.controller('queryLogController', function($scope, $http) {
	//get Queries from Proxy, when Click Refresh Button
	//https://www.w3schools.com/angular/angular_http.asp
    //var receivedQueries = [];
    $scope.receivedQueries = [];

    $http.get('http://localhost:5060').then(processReceivedQueries);

	function processReceivedQueries(queries){
		queries.data.forEach(function (query){
			var newQuery = new Object();
			newQuery.date = query.time;
			newQuery.status = "Status";
			newQuery.coreQuery = query.query;
			newQuery.keywordString = extractKeywords(query.query);
			newQuery.url = query.url;
			$scope.receivedQueries.push(newQuery);

		});
	};

	function extractKeywords(queryString){
		var keywords = ["SELECT","PREFIX"];
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