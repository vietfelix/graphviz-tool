(function (document) {
    //http://stackoverflow.com/a/10372280/398634
    window.URL = window.URL || window.webkitURL;
    var el_stetus = document.getElementById("status"),
      t_stetus = -1,
      reviewer = document.getElementById("review"),
      scale = window.devicePixelRatio || 1,
      editor = ace.edit("editor"),
      lastHD = -1,
      worker = null,
      parser = new DOMParser(),
      showError = null,
      formatEl = document.querySelector("#format select"),
      engineEl = document.querySelector("#engine select"),
      rawEl = document.querySelector("#raw input"),
      shareEl = document.querySelector("#share"),
      shareURLEl = document.querySelector("#shareurl"),
      errorEl = document.querySelector("#error");
    function show_status(text, hide) {
      hide = hide || 0;
      clearTimeout(t_stetus);
      el_stetus.innerHTML = text;
      if (hide) {
        t_stetus = setTimeout(function () {
          el_stetus.innerHTML = "";
        }, hide);
      }
    }
    function show_error(e) {
      show_status("error", 500);
      reviewer.classList.remove("working");
      reviewer.classList.add("error");
      var message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;
      while (errorEl.firstChild) {
        errorEl.removeChild(errorEl.firstChild);
      }
      errorEl.appendChild(document.createTextNode(message));
    }
    function svgXmlToImage(svgXml, callback) {
      var pngImage = new Image(), svgImage = new Image();
      svgImage.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = svgImage.width * scale;
        canvas.height = svgImage.height * scale;
        var context = canvas.getContext("2d");
        context.drawImage(svgImage, 0, 0, canvas.width, canvas.height);
        pngImage.src = canvas.toDataURL("image/png");
        pngImage.width = svgImage.width;
        pngImage.height = svgImage.height;
        if (callback !== undefined) {
          callback(null, pngImage);
        }
      }
      svgImage.onerror = function (e) {
        if (callback !== undefined) {
          callback(e);
        }
      }
      svgImage.src = svgXml;
    }
    function copyToClipboard(str) {
      const el = document.createElement('textarea');
      el.value = str;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      const selected =
        document.getSelection().rangeCount > 0
          ? document.getSelection().getRangeAt(0)
          : false;
      el.select();
      var result = document.execCommand('copy')
      document.body.removeChild(el);
      if (selected) {
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(selected);
      }
      return result;
    };
    function renderGraph() {
      reviewer.classList.add("working");
      reviewer.classList.remove("error");
      if (worker) {
        worker.terminate();
      }
      worker = new Worker("graphviz/full.render.js");
      worker.addEventListener("message", function (e) {
        if (typeof e.data.error !== "undefined") {
          var event = new CustomEvent("error", {"detail": new Error(e.data.error.message)});
          worker.dispatchEvent(event);
          return
        }
        show_status("done", 500);
        reviewer.classList.remove("working");
        reviewer.classList.remove("error");
        updateOutput(e.data.result);
      }, false);
      worker.addEventListener('error', function (e) {
        show_error(e.detail);
      }, false);
      show_status("rendering...");
      var params = {
        "src": editor.getSession().getDocument().getValue(),
        "id": new Date().toJSON(),
        "options": {
          "files": [],
          "format": formatEl.value === "png-image-element" ? "svg" : formatEl.value,
          "engine": engineEl.value
        },
      };
      worker.postMessage(params);
    }
    function updateState() {
      var content = encodeURIComponent(editor.getSession().getDocument().getValue());
      history.pushState({"content": content}, "", "#" + content)
    }
    function updateOutput(result) {
      if (formatEl.value === "svg") {
        document.querySelector("#raw").classList.remove("disabled");
        rawEl.disabled = false;
      } else {
        document.querySelector("#raw").classList.add("disabled");
        rawEl.disabled = true;
      }
      var svg = reviewer.querySelector("svg");
      if (svg) {
        reviewer.removeChild(svg);
      }
      var text = reviewer.querySelector("#text");
      if (text) {
        reviewer.removeChild(text);
      }
      var a = reviewer.querySelector("a");
      if (a) {
        reviewer.removeChild(a);
      }
      if (!result) {
        return;
      }
      reviewer.classList.remove("working");
      reviewer.classList.remove("error");
      if (formatEl.value == "svg" && !rawEl.checked) {
        var svg = parser.parseFromString(result, "image/svg+xml");
        reviewer.appendChild(svg.documentElement);
      } else if (formatEl.value == "png-image-element") {
        var resultWithPNGHeader = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(result)));
        svgXmlToImage(resultWithPNGHeader, function (err, image) {
          if (err) {
            show_error(err)
            return
          }
          image.setAttribute("title", "Click to save it");
          var a = document.createElement("a");
          a.href = image.src;
          a.target = "_blank";
          a.download = "graphviz.png";
          a.appendChild(image);
          reviewer.appendChild(a);
        })
      } else {
        var text = document.createElement("div");
        text.id = "text";
        text.appendChild(document.createTextNode(result));
        reviewer.appendChild(text);
      }
      updateState()
    }
    editor.setTheme("ace/theme/twilight");
    editor.getSession().setMode("ace/mode/dot");
    editor.getSession().on("change", function () {
      clearTimeout(lastHD);
      lastHD = setTimeout(renderGraph, 1500);
    });
    window.onpopstate = function(event) {
      if (event.state != null && event.state.content != undefined) {
        editor.getSession().setValue(decodeURIComponent(event.state.content));
      }
    };
    formatEl.addEventListener("change", renderGraph);
    engineEl.addEventListener("change", renderGraph);
    rawEl.addEventListener("change", renderGraph);
    /* come from sharing */
    if (location.hash.length > 1) {
      editor.getSession().setValue(decodeURIComponent(location.hash.substring(1)));
    }
    /* Init */
    if (editor.getValue()) {
      renderGraph();
    }
  })(document);
