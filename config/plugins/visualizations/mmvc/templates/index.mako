<%
    app_root = "/static/mmvc/"
%>
<%
    dataset_id = pageargs["query"]["dataset_id"]
%>


<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Javascript Alignment Viewer</title>
    ${h.javascript_link( app_root +  "bundle.js" )}
    ${h.js('libs/d3', 'libs/underscore')}
  </head>
  <body>
    <div id="alignmentjs"></div>
  </body>
  <script type="text/javascript">

    var dataset_id = "${dataset_id}";
    var dataset_url = "/api/datasets/" + dataset_id;

    d3.json(dataset_url, function(dataset_info) {

      var history_id = dataset_info.history_id;
      var history_url = "/api/histories/" + history_id + "/contents";

      d3.json(history_url, function(d) {

        // find fasta file directly adjacent to mmvc file
        var index = _.findIndex(d, function(d) { return d.id == dataset_id;});
        var new_dataset = _.first(d, index);

        // move backwards from index to find FASTA file
        var fasta_dataset = _.last(_.filter(new_dataset, function(d) { return d.extension == "fasta" }));

        // create urls for alignmentjs
        var json_id = "/datasets/" + dataset_id + "/display?to_ext=json";
        var fasta_id = "/datasets/" + fasta_dataset.id + "/display?to_ext=text";

        alignmentjs(fasta_id, json_id, document.getElementById('alignmentjs'));


      });
    });
  </script>
</html>
