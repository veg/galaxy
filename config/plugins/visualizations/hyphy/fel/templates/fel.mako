<%
  app_root = "/static/plugins/visualizations/hyphy/static/"
%>

<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>HyPhy-FEL</title>

    ${h.stylesheet_link( app_root + 'main.css' )}
    ${h.javascript_link( app_root + 'bundle.js' )}
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.6.3/css/all.css">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.6.3/css/v4-shims.css">
  </head>
  <body>
    <div id="hyphy-vision-root" />
  </body>
  <script type="text/javascript">
    var raw_url = '${h.url_for( controller="/datasets", action="index" )}';
    var hda_id = '${trans.security.encode_id( hda.id )}';
    var url = raw_url + '/' + hda_id + '/display?to_ext=json';

    fel(url, "hyphy-vision-root");
  </script>
</html>
