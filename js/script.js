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

app.controller('queryLogController', function($scope) {
	$scope.message = 'Iam the QueryLog Page really';
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