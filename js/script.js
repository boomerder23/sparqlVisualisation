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
	$scope.getQueries = function() {
		console.log('getQueries');
		$http.get('http://localhost:5060')
		.then(function (response) {
        	//first function handles success
        	console.log('success');
        	$scope.queries = response.data;
        }, function(response) {
            console.log('failed');    	
        	$scope.httpMessage = 'Failed to get Queries. Code: ' + response.status;
        });
	}

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