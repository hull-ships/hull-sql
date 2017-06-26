/* @flow */
/* global original_query, swal */
import CodeMirror from "codemirror";
import $ from "jquery";
import "codemirror/lib/codemirror.css";
import "sweetalert/dist/sweetalert.css";
import "sweetalert";
import "codemirror/mode/sql/sql.js";

(function boot() {
  let good_query = null;
  const { original_query, swal } = window;

  $(() => {
    const editor = CodeMirror.fromTextArea(document.getElementById("querying"), {
      mode: "text/x-pgsql",
      indentWithTabs: false,
      parserfile: "codemirror/contrib/sql/js/parsesql.js",
      path: "codemirror/js/",
      stylesheet: "css/sqlcolors.css",
      smartIndent: true,
      lineNumbers: true,
      matchBrackets: true,
      autofocus: true
    });

    console.log($("$ ready"));
    $(".to-disable").prop("disabled", false);

    function empty() {
      $("#preview-query").empty().hide();
      $("#error-query").empty().hide();
      $("#result thead tr").empty();
      $("#result tbody").empty();
      $("#results-title").empty();
    }


    $("#button_import").click(() => {
      const query = editor.getValue();

      if (query === "") return swal("Empty query", "The current query is empty", "warning");

      if (query !== original_query) return swal("Unsaved query", "The current query is not the query you saved. Please save your query first.", "warning");

      return swal({
        title: "Import the users from the current query? ",
        text: "If you continue, we will import the users from the currently saved query.",
        type: "warning",
        showCancelButton: true,
        confirmButtonColor: "#DD6B55",
        confirmButtonText: "Let's Go",
        closeOnConfirm: false
      }, isConfirm => {
        if (isConfirm === true) {
          $("#button_import")
            .prop("disabled", true);
          $("#button_import").text("Importing...");
          empty();


          swal("Started importing users. Results will be available shortly in Hull!");


          $.ajax({
            url: `/import${window.location.search}`,
            type: "post",
            data: {
              query,
              incremental: true
            },
            success() {
              $(".to-disable").prop("disabled", false);
              $("#button_import").replaceWith("<button id=\"button_import\" class=\"btn-pill btn-rounded btn-danger btn to-disable\"><i class=\"icon icon-reset\"></i> Import everything</button>");
            },
            error(err) {
              $(".to-disable").prop("disabled", false);
              $("#error-query")
                .empty()
                .css("display", "block")
                .append(err.message);
            }
          });
        }
      });
    });

    function getColumnType(entries, columnName) {
      try {
        if (entries && entries.length) {
          const values = entries.reduce((ret, e) => {
            const val = e && e[columnName];
            if (val) ret.push(val);
            return ret;
          }, []);
          return values[0] && values[0].constructor && values[0].constructor.name;
        }
      } catch (err) {
        return "";
      }
      return "";
    }

    $("#button_preview").click(() => { // eslint-disable-line consistent-return
      console.log("#button_preview clicked");
      empty();
      good_query = null;

      const query = editor.getValue();
      if (query === "") return swal("Empty query", "The current query is empty", "warning");

      $(".to-disable").prop("disabled", true);
      $("#loading-query").show();

      $.ajax({
        url: `/run${window.location.search}`,
        type: "post",
        data: { query },
        success(data) {
          $(".to-disable").prop("disabled", false);
          $("#loading-query").hide();

          try {
            if (data.entries && data.entries.length) {
              for (const columnName in data.entries[0]) { // eslint-disable-line no-restricted-syntax,guard-for-in
                $("#result thead tr").append(`<th>${columnName}<em>(${getColumnType(data.entries, columnName)})</em></th>`);
              }

              data.entries.forEach((element) => {
                const currentRow = [];
                $.each(element, (key, value) => {
                  currentRow.push(`<td><small>${(typeof(value) === "object" && value !== null) ? `<pre style='min-width:200px'><code>${JSON.stringify(value)}</code></pre>` : value}</small></td>`);
                });
                $("#result tbody").append(`<tr>${currentRow.join("")}<tr>`);
              });
            } else {
              $("#error-query")
                .empty()
                .show()
                .append("No results for this query.");
            }

            good_query = query;
          } catch (err) {
            good_query = original_query;
            $("#error-query")
              .empty()
              .show()
              .append(data.message);
          } finally {
            if (good_query !== original_query) {
              window.parent.postMessage(JSON.stringify({
                from: "embedded-ship",
                action: "update",
                ship: {
                  private_settings: {
                    query: good_query
                  }
                }
              }), "*");
            }
          }
        },
        error(res) {
          const err = res.responseJSON;
          $(".to-disable").prop("disabled", false);
          $("#loading-query").hide();
          if (err) {
            $("#error-query")
              .empty()
              .show()
              .append(err.message);
            good_query = original_query;
            window.parent.postMessage(JSON.stringify({
              from: "embedded-ship",
              action: "update",
              ship: {
                private_settings: {
                  query: good_query
                }
              }
            }), "*");
          }
        }
      });
    });
  });
}());
