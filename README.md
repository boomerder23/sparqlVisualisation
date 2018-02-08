# sparqlVisualisation
The Sparql Visualisation application can be used to display logged SPARQL queries from an external proxy server, also it is possible
to visualise the graph pattern underneath every query. In addition to the mentioned functions it is possible to preview the results 
of a query and in case of a unsuccessful query there is also an designeated area for future debugging opportunities.

To start the app, you need to run local http server with the path to the repository. We used the small http-server package which can be
install via "npm install http-server -g". To start the server just execute http-server -c-1 from inside the repository path. 
To get data in the application you need the proxy project "sparqlLogProxy". Replace the original server.js file from the proxy project
with the on from this repository. This is mandatory for the working of the application!