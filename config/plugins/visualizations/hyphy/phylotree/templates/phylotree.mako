<%
  app_root = "/static/plugins/visualizations/hyphy/static/"
%>

<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>HyPhy-aBSREL</title>

    ${h.stylesheet_link( app_root + 'main.css' )}
    ${h.javascript_link( app_root + 'bundle.js' )}
  </head>
  <body>
    <div style="width: 800px;" id="hyphy-phylotree-root" />
  </body>
  <script type="text/javascript">
    var raw_url = '${h.url_for( controller="/datasets", action="index" )}';
    var hda_id = '${trans.security.encode_id( hda.id )}';
    var url = raw_url + '/' + hda_id + '/display?to_ext=json';

    function createAnnotatedNewick(newick) {
      window.parent.Galaxy.data.create({
        file_name: "AnnotatedTree.nhx",
        url_paste: newick,
        extension: "hyphy_nhx",
        success: (response) => {window.console.log(response)}
      });
    }

    $.ajax({
      url: url,
      success: function(result) {
        render_branch_selection(
          'hyphy-phylotree-root',
          result,
          null,
          createAnnotatedNewick,
          500,
          500,
          true
        );
      }
    });

  </script>
</html>

