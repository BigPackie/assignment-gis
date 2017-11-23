


var QueryBuilder = function (pointDistance, natureDistance,pumpDistance) {

    var pointDistance = pointDistance;
    var natureDistance = natureDistance;
    var pumpDistance = pumpDistance;

    var regexTest = /\;|\,|\'|\"/; //matching anything other than alphanum and underscore


    function checkPointQueryParam(point) {
        if(!point){
            console.log("Invalid point param, param not defined or null");
            return false;
        }else if (typeof point.lat !== "number" || typeof point.long !== "number"){
            console.log("Invalid point param");
            return false;
        }else if (point.lat < -90 || point.lat  > 90  ||  point.long < -180 || point.long > 180 ){
            console.log("Invalid point param, outside bounds");
            return false;
        }

        return true;
    }

    function checkCityQueryParam(city) {
        if(regexTest.test(city)){
            console.log("Invalid city param");
            return false;
        }else{
            return true;
        }
    }

    function checkNatureParam(nature) {
        if( typeof nature === 'object'  && typeof nature.water === 'boolean' && typeof nature.green === 'boolean'){
            return true;
        }else{
            console.log("Invalid nature param");
            return false;
        }
    }

    
    function buildInitialWithMyPoint(point) {
        var query =  " WITH myPoint AS(\n" +
                     "    \tSELECT ST_Point(" + point.long + ", " + point.lat + ") as way\n" +
                     "    )";

        return query;
    }


    function buildContinueWithNatureNearPoint(nature) {

        var query = "";

        if(!nature.green && !nature.water){
            return query;
        }

        var green = "false";
        var water = "false";

        if(nature.green){
            green = greenCondition()
        }

        if(nature.water){
            water = waterCondition();
        }

        var query =  ", natureNearPoint AS(\n" +
            " \tSELECT poly.*\n" +
            "    FROM planet_osm_polygon poly, myPoint\n" +
            "    WHERE ST_DWithin(myPoint.way, poly.way," + pointDistance + ",true) \n" +
            "         AND (\n" +
            "                 (" + green + ")\n" +
            "                  OR\n" +
            "                 (" + water + ")\n" +
            "              )\n" +
            " \t)";

        return query;
    }


    function greenCondition(){
        return "poly.leisure IN ('park','nature_reserve','garden')\n" +
            "                  OR poly.boundary = 'national_park'\n" +
            "                  OR poly.natural = 'wood'\n" +
            "                  OR poly.landuse IN ('forest','recreation_ground')"
    }


    function waterCondition(){
        return "poly.natural='water' \n" +
            "        AND poly.water  NOT IN ('canal','wastewater')"
    }



    function buildContinueWithRestaurantNearPoint() {

        var query = "";


        var query =  ", restaurantNearPoint AS(\n" +
            "     SELECT  DISTINCT ON (point_A.way) point_A.way,\n" +
            "     \t\t\tpoint_A.name, ST_DistanceSphere(point_A.way,myPoint.way) as distance\n" +
            "      FROM planet_osm_point point_A, myPoint\n" +
            "      WHERE point_A.amenity = 'restaurant' AND point_A.name IS NOT NULL\n" +
            "      AND ST_DistanceSphere(point_A.way,myPoint.way) < " + pointDistance + "\n" +
            " \t) ";

        return query;
    }


    //complete queries


    function buildEndRestaurantsByPointByNature(nature){
        var queryEnd = "";

        if(nature.water || nature.green) {
            queryEnd = "SELECT DISTINCT ON (res.way) res.way, res.name, ST_AsGeoJSON(res.way) as geojson, res.distance\n" +
                "    FROM restaurantNearPoint res, natureNearPoint nat\n" +
                "    WHERE ST_DWithin(res.way, nat.way, " +  natureDistance + ", true);";
        }else{
            queryEnd = "SELECT DISTINCT ON (res.way) res.way, res.name, ST_AsGeoJSON(res.way) as geojson, res.distance\n" +
                "    FROM restaurantNearPoint res;";
        }
        return queryEnd;
    }

    this.buildQuery_getRestaurantsByPointByNature = function(point, nature){

        var completeQuery = "";

        if(!checkPointQueryParam(point) || !checkNatureParam(nature)){
            return completeQuery;
        }

        completeQuery = buildInitialWithMyPoint(point)
            + buildContinueWithNatureNearPoint(nature)
            + buildContinueWithRestaurantNearPoint()
            + buildEndRestaurantsByPointByNature(nature);

        return completeQuery;
    }


    function buildContinueWithGreenNearPoint(){
            return ", greenNearPoint AS(\n" +
                " SELECT  poly.*\n" +
                "    FROM planet_osm_polygon poly, myPoint\n" +
                "    WHERE (poly.leisure IN ('park','nature_reserve','garden')\n" +
                "              OR poly.boundary = 'national_park'\n" +
                "              OR poly.natural = 'wood'\n" +
                "              OR poly.landuse IN ('forest','recreation_ground'))\n" +
                "       AND  ST_DWithin(myPoint.way, poly.way," + pointDistance  + ",true)\n" +
                " )"
    }

    function buildContinueWithWaterNearPoint(){
            return ", waterNearPoint AS(\n" +
                " SELECT  poly.*\n" +
                "    FROM planet_osm_polygon poly, myPoint\n" +
                "    WHERE poly.natural='water' \n" +
                "    AND  poly.water  NOT IN ('canal','wastewater')\n" +
                "        AND  ST_DWithin(myPoint.way, poly.way," + pointDistance + ",true)\n" +
                " )"
    }

    function buildEndNatureByPoint(){
        var queryEnd = "    SELECT 'green' as typ,  ST_AsGeoJSON(greenNearPoint.way) as geoJSON FROM greenNearPoint\n" +
            "    UNION\n" +
            "    SELECT  'water' as typ,  ST_AsGeoJSON(waterNearPoint.way) as geoJSON FROM waterNearPoint;";

        return queryEnd;
    }

    this.buildQuery_getNatureByPoint = function(point){

        var completeQuery = "";

        if(!checkPointQueryParam(point)){
            return completeQuery;
        }

        completeQuery = buildInitialWithMyPoint(point)
            + buildContinueWithGreenNearPoint()
            + buildContinueWithWaterNearPoint()
            + buildEndNatureByPoint();

        return completeQuery;
    }


    this.buildQuery_getCity = function(city) {
        var completeQuery = "";

        if(!checkCityQueryParam(city)){
            return completeQuery;
        }
        completeQuery = "SELECT name,ST_AsGeoJSON(way)as geojson FROM planet_osm_point point\n" +
        "WHERE LOWER(unaccent(point.name)) LIKE LOWER(unaccent('%" + city  +"%')) AND point.place IN ('city','town') LIMIT 1;";

        return completeQuery;
    }

    this.buildQuery_getPumps = function(start,end) {
        var completeQuery = "";

        if(!checkPointQueryParam(start) || !checkPointQueryParam(end)){
            return completeQuery;
        }

        completeQuery = "WITH line AS (\n" +
            "             SELECT ST_MakeLine( ST_Point(" + start.long + ", "+ start.lat +"),\n" +
            "                                ST_Point(" + end.long + ", "+ end.lat +"))::geography as way\n" +
            "         ), pumps AS(\n" +
            "             SELECT  planet_osm_point.name,  planet_osm_point.way,\n" +
            "             round(ST_DistanceSphere(ST_Point(" + start.long + ", "+ start.lat +"),planet_osm_point.way)) as dist\n" +
            "             FROM planet_osm_point,line\n" +
            "             WHERE  amenity= 'fuel' \n" +
            "             AND name IS NOT NULL\n" +
            "             AND ST_Contains((ST_Buffer(line.way, " + pumpDistance+ "))::geometry, planet_osm_point.way)        \n" +
            "         )SELECT  pumps.name, pumps.dist, ST_AsGeoJson(pumps.way) AS geojson\n" +
            "         FROM line, pumps;";

        return completeQuery;
    }

}

const queryBuilder = new QueryBuilder(20000,100,5000);

module.exports = queryBuilder;