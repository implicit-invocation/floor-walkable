var WorldWalkable = require('world-walkable');
var JsPolygonal = require('js-polygonal');
var AStarWaypoint = JsPolygonal.AStarWaypoint;
var Graph = JsPolygonal.Graph;
var AStar = JsPolygonal.AStar;
var DA = JsPolygonal.DA;
var GraphNode = JsPolygonal.GraphNode;

function FloorWalkable() {
  this.floors = {};
  this.waypoints = {};
  this.graph = new Graph();
}

FloorWalkable.prototype.addFloor = function(id, bound, obstacleData) {
  var worldWalkable = new WorldWalkable(bound);
  for (var i = 0; i < obstacleData.length; i++) {
    worldWalkable.addPolyline(obstacleData[i]);
  }
  this.floors[id] = worldWalkable;
  this.waypoints[id] = [];
};

FloorWalkable.prototype.addPolyline = function(floorId, polyline) {
  var floor = this.floors[floorId];
  if (floor) {
    floor.addPolyline(polyline);
  }
};

FloorWalkable.prototype.addWaypoint = function(name, placements) {
  var graph = this.graph;
  var wp = new AStarWaypoint();
  wp.name = name;
  wp.node = graph.addNode(graph.createNode(wp));
  for (var i = 0; i < placements.length; i++) {
    var placement = placements[i];
    var floorId = placement.floorId;
    if (!this.floors[floorId]) {
      continue;
    }
    var floorWp = new AStarWaypoint();
    floorWp.name = name;
    floorWp.floorId = floorId;
    floorWp.lat = placement.lat;
    floorWp.lng = placement.lng;
    floorWp.node = graph.addNode(graph.createNode(floorWp));
    graph.addMutualArc(wp.node, floorWp.node);
    this.waypoints[floorId].push(floorWp);
  }
};

FloorWalkable.prototype.findPath = function(
  fromFloorId,
  fromLat,
  fromLng,
  toFloorId,
  toLat,
  toLng
) {
  var graph = this.graph;
  var fromFloor = this.floors[fromFloorId];
  var toFloor = this.floors[toFloorId];
  if (!fromFloor || !toFloor) {
    return false;
  }

  var fromWp = new AStarWaypoint();
  fromWp.floorId = fromFloorId;
  var toWp = new AStarWaypoint();
  toWp.floorId = toFloorId;

  fromWp.node = graph.addNode(graph.createNode(fromWp));
  toWp.node = graph.addNode(graph.createNode(toWp));

  var fromWaypoints = this.waypoints[fromFloorId];
  var toWaypoints = this.waypoints[toFloorId];

  // TODO: check whether starting point and goal can reach waypoints

  for (var i = 0; i < fromWaypoints.length; i++) {
    graph.addMutualArc(fromWp.node, fromWaypoints[i].node);
  }

  for (var i = 0; i < toWaypoints.length; i++) {
    graph.addMutualArc(toWp.node, toWaypoints[i].node);
  }

  var path = new DA();
  var astar = new AStar(graph);

  var isPathExist = astar.find(graph, formWp, toWp, path);

  graph.removeNode(fromWp.node);
  graph.removeNode(toWp.node);

  if (!isPathExist) {
    return false;
  }

  var fromWaypoint = path.get(1);
  var toWaypoint = path.get(length - 2);

  var fromFloorPath = fromFloor.findPath(
    fromLat,
    fromLng,
    fromWaypoint.lat,
    fromWaypoint.lng
  );
  var toFloorPath = toFloor.findPath(
    toWaypoint.lat,
    toWaypoint.lng,
    toLat,
    toLng
  );

  var fullPath = [];

  for (var i = 0; i < fromFloorPath.length; i++) {
    fullPath.push({
      type: 'walk',
      latlng: fromFloorPath[i],
      floorId: fromFloorId
    });
  }
  for (var i = 1; i < path.size() - 1; i++) {
    var wp = path.get(i);
    fullPath.push({
      type: 'waypoint',
      floorId: wp.floorId,
      name: wp.name
    });
  }
  for (var i = 0; i < toFloorPath.length; i++) {
    fullPath.push({
      type: 'walk',
      latlng: toFloorPath[i],
      floorId: toFloorId
    });
  }
};

module.exports = FloorWalkable;
