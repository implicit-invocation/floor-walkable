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

    for (var j = 0; j < this.waypoints[floorId].length; j++) {
      var floor = this.floors[floorId];
      var oldWp = this.waypoints[floorId][j];
      var path = floor.findPath(
        [oldWp.lat, oldWp.lng],
        [floorWp.lat, floorWp.lng]
      );
      if (path.length > 0) {
        graph.addMutualArc(oldWp.node, floorWp.node);
      }
    }
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
  var fullPath = [];

  if (fromFloorId == toFloorId) {
    var floor = this.floors[fromFloorId];
    var singleFloorPath = floor.findPath([fromLat, fromLng], [toLat, toLng]);
    if (singleFloorPath && singleFloorPath.length > 0) {
      for (var i = 0; i < singleFloorPath.length; i++) {
        fullPath.push({
          type: 'walk',
          latlng: singleFloorPath[i],
          floorId: toFloorId
        });
      }
      return fullPath;
    }
  }

  var graph = this.graph;
  var fromFloor = this.floors[fromFloorId];
  var toFloor = this.floors[toFloorId];
  if (!fromFloor || !toFloor) {
    return false;
  }

  var fromWp = new AStarWaypoint();
  fromWp.floorId = fromFloorId;
  fromWp.lat = fromLat;
  fromWp.lng = fromLng;
  fromWp.temp = true;
  var toWp = new AStarWaypoint();
  toWp.floorId = toFloorId;
  toWp.lat = toLat;
  toWp.lng = toLng;
  toWp.temp = true;

  fromWp.node = graph.addNode(graph.createNode(fromWp));
  toWp.node = graph.addNode(graph.createNode(toWp));

  var fromWaypoints = this.waypoints[fromFloorId];
  var toWaypoints = this.waypoints[toFloorId];

  // CHECKED: check whether starting point and goal can reach waypoints
  var isFromWaypointReachable = false;
  var isToWaypointReachable = false;
  for (var i = 0; i < fromWaypoints.length; i++) {
    var fromPath = fromFloor.findPath(
      [fromLat, fromLng],
      [fromWaypoints[i].lat, fromWaypoints[i].lng]
    );
    if (fromPath.length > 0) isFromWaypointReachable = true;
  }
  for (var i = 0; i < toWaypoints.length; i++) {
    var toPath = toFloor.findPath(
      [toLat, toLng],
      [toWaypoints[i].lat, toWaypoints[i].lng]
    );
    if (toPath.length > 0) isToWaypointReachable = true;
  }

  if (!isFromWaypointReachable || !isToWaypointReachable) return false;

  for (var i = 0; i < fromWaypoints.length; i++) {
    graph.addMutualArc(fromWp.node, fromWaypoints[i].node);
  }

  for (var i = 0; i < toWaypoints.length; i++) {
    graph.addMutualArc(toWp.node, toWaypoints[i].node);
  }

  var path = new DA();
  var astar = new AStar(graph);

  var isPathExist = astar.find(graph, fromWp, toWp, path);

  graph.removeNode(fromWp.node);
  graph.removeNode(toWp.node);

  if (!isPathExist) {
    return false;
  }

  fullPath.push({
    type: 'walk',
    latlng: [fromLat, fromLng],
    floorId: fromFloorId
  });

  for (var i = 1; i < path.size(); i++) {
    var wp = path.get(i);
    var prevWp = path.get(i - 1);
    if (wp.floorId != prevWp.floorId) {
      if (wp.floorId) {
        if (!prevWp.temp) {
          fullPath[fullPath.length - 1].connectedFloorId = wp.floorId;
        }
        fullPath.push({
          type: 'waypoint',
          floorId: wp.floorId,
          name: wp.name,
          connectedFloorId: fullPath[fullPath.length - 1].floorId
        });
      }
    } else {
      var floorMesh = this.floors[wp.floorId];
      var floorPath = floorMesh.findPath(
        [prevWp.lat, prevWp.lng],
        [wp.lat, wp.lng]
      );
      for (var j = 0; j < floorPath.length; j++) {
        fullPath.push({
          type: 'walk',
          latlng: floorPath[j],
          floorId: wp.floorId
        });
      }
      if (!wp.temp) {
        fullPath.push({
          type: 'waypoint',
          floorId: wp.floorId,
          name: wp.name
        });
      }
    }
  }
  return fullPath;
};

module.exports = FloorWalkable;
