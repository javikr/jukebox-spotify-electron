angular.module('JukeboxApp', [
  'JukeboxApp.services',
  'JukeboxApp.controllers',
  'ngRoute'
]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.
	when("/main", {templateUrl: "partials/main.html", controller: "mainController"}).
	when("/drivers/:id", {templateUrl: "partials/driver.html", controller: "driverController"}).
	otherwise({redirectTo: '/main'});
}]);
