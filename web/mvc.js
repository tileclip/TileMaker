app.mvc = (function() {
'use strict';

var $id = document.getElementById.bind(document);

var INITIAL_MIN_EDGE = 200;
var MIN_DRAG_DELTA_SQUARED = 4;
var GRID_SQUARE = 100;
var MM_WIDTH = 200;
var MM_PER_INCH = 25.4;
var INCH_WIDTH = MM_WIDTH / MM_PER_INCH;
var MM_MARGIN = 3;
var MM_PDF = MM_WIDTH+MM_MARGIN*2;
var MARGIN = GRID_SQUARE * MM_MARGIN / MM_WIDTH;
var MIN_CROP_SIZE = GRID_SQUARE + MARGIN + MARGIN;
var INITIAL_SIZE = 200;
var INITIAL_SCALE = 1;
var INITIAL_SCALED_SIZE = INITIAL_SIZE * INITIAL_SCALE; 
var BUTTON_SIZE = 24;
var STATIC_TILES_WIDE = 8;
var STATIC_TILES_HIGH = 5;

var GOOD_RES = 120;
var FAIR_RES = 50;

var app;

var model = (function() {
  var scrollX = 0, scrollY = 0;
  var imgWidth = INITIAL_SIZE, imgHeight = INITIAL_SIZE, scaledWidth = INITIAL_SCALED_SIZE, scaledHeight = INITIAL_SCALED_SIZE;
  var imgScale = INITIAL_SCALE;
  var fileName = "unnamed";
  
  var numTilesX = 1, numTilesY = 1;
  var setNumTilesX = null, setNumTilesY = null;
  
  function update() {
    computeNumTiles();
    app.trigger('update', {
      scrollX: scrollX,
      scrollY: scrollY,
      imgWidth: imgWidth,
      imgHeight: imgHeight,
      scaledWidth: scaledWidth,
      scaledHeight: scaledHeight,
      imgScale: imgScale,
      numTilesX: numTilesX,
      numTilesY: numTilesY,
      fileName: fileName
    });
  }
  
  function computeNumTiles(setX, setY) {
    numTilesX = Math.floor((scaledWidth + scrollX - MARGIN*2) / GRID_SQUARE);
    numTilesY = Math.floor((scaledHeight + scrollY - MARGIN*2) / GRID_SQUARE);
    
    if (setNumTilesX && numTilesX > setNumTilesX) numTilesX = setNumTilesX;
    if (setNumTilesY && numTilesY > setNumTilesY) numTilesY = setNumTilesY;
  }
  
  function init() {
    app.on('loadImage', function(dataURL, width, height, _fileName) {
      imgWidth = width;
      imgHeight = height;
      fileName = _fileName || "unnamed";
      initialScale();
      app.trigger('dataURL', dataURL);
      update();
    });
  
    // set scroll
    app.on('scroll', function scroll(deltaX, deltaY) {
      scrollX += deltaX;
      scrollY += deltaY;
      if (scrollY > 0) scrollY = 0;
      if (scrollX > 0) scrollX = 0;
      
      // compute scrollX and scrollY for which corner of image will only take up 120 px
      var minScrollX = MIN_CROP_SIZE-scaledWidth;
      var minScrollY = MIN_CROP_SIZE-scaledHeight;
      if (scrollX < minScrollX) scrollX = minScrollX;
      if (scrollY < minScrollY) scrollY = minScrollY;
      
      update();
    });
    
    app.on("setNumTiles", function setNumTiles(x, y) {
      setNumTilesX = x || setNumTilesX;
      setNumTilesY = y || setNumTilesY;
      update();
    });
    
    app.on('lock', function lock() {
      setNumTilesX = numTilesX;
      setNumTilesY = numTilesY;
    });
    
    app.on('unlock', function unlock() {
      setNumTilesX = null;
      setNumTilesY = null;
    });
  
    function computeMinImageScale() {
      var minX = (MIN_CROP_SIZE - scrollX) / imgWidth;
      var minY = (MIN_CROP_SIZE - scrollY) / imgHeight;
      return (minX > minY ? minX : minY);
    }
  
    // set scale
    app.on('scale', function scale(x, y) {
      var m = scaledHeight / scaledWidth;
      var b = scrollY - (m * scrollX);

      var resX = (m * y + x - m * b) / (m * m + 1);
      var resY = (m * m * y + m * x + b) / (m * m + 1);
      
      var topEdge = resX - scrollX;
      var sideEdge = resY - scrollY;

      imgScale = topEdge / imgWidth;
      var minImgScale = computeMinImageScale();
      if (minImgScale > imgScale) imgScale = minImgScale;
      computeScaledDims();
      
      update();

    });
    update();
  }
  
  function computeScaledDims() {
    scaledWidth = imgWidth * imgScale;
    scaledHeight = imgHeight * imgScale;
  }
  
  function initialScale() {
    if (imgWidth < imgHeight) imgScale = INITIAL_MIN_EDGE / imgWidth;
    else imgScale = INITIAL_MIN_EDGE / imgHeight;
    computeScaledDims();
  }
  
  return {
    init: init,
    scroll: scroll
  }
  
})();

var view = (function() {

  var image, scaleButton, grid, gridString, clips;
  
  function getGridStr(tilesWide, tilesHigh, size, margin) {
    var i, l=tilesWide;
    var str = '';
    for (i=0; i<=l; i++) {
      str += (" M " + (i*size+margin) + " " + margin + " l 0 " + (tilesHigh * size));
    }
    l = tilesHigh;
    for (i=0; i<=l; i++) {
      str += (" M " + margin + " " + (i*size+margin) + " l " + (tilesWide * size) + " 0");
    }
    return str;
  }
  
  function computeGridString(numTilesX, numTilesY) {
    gridString = getGridStr(numTilesX, numTilesY, GRID_SQUARE, MARGIN);
  }
  
  function computeStaticString(numTilesX, numTilesY) {
    return getGridStr(STATIC_TILES_WIDE, STATIC_TILES_HIGH, GRID_SQUARE, MARGIN);
  }
  
  function computeResolution(scale) {
    return Math.round(GRID_SQUARE / INCH_WIDTH / scale);
  }
  
  function init(_image, button, _grid, wide, high) {
    image = _image;
    scaleButton = button;
    grid = _grid;
    
    clips = {
      lClips: $id('l_clips'),
      tClips: $id('t_clips'),
      xClips: $id('x_clips')
    }
      
    var staticGrid = $id('static_grid');
    var resSpan = $id('resolution');
    var warnSpan = $id('warning');
    var face = $id('face');
    
    var staticStr = computeStaticString();
    
    staticGrid.setAttribute("d", staticStr);
    
    app.on('dataURL', function loadImage(dataURL) {
      image.setAttribute("xlink:href", dataURL);
    });
  
    function getResQuality(res) {
      if (res >= GOOD_RES) return 'good';
      if (res >= FAIR_RES) return 'fair';
      return 'poor';
    }
  
    app.on('update', function update(state) {
      var xTiles = state.numTilesX, yTiles = state.numTilesY;
      image.setAttribute("transform", "translate("+state.scrollX+", "+state.scrollY+")");
      image.setAttribute("width", state.scaledWidth);
      image.setAttribute("height", state.scaledHeight);
      var buttonX = state.scrollX+state.scaledWidth;
      var buttonY = state.scrollY+state.scaledHeight;
      scaleButton.setAttribute("transform", "translate("+buttonX+", "+buttonY+")");
      computeGridString(xTiles, yTiles);
      grid.setAttribute("d", gridString);
      wide.value = xTiles;
      high.value = yTiles;
      clips.lClips.textContent = "4";
      clips.tClips.textContent = ''+((xTiles-1)*2 + (yTiles-1)*2);
      clips.xClips.textContent = ''+((xTiles-1)*(yTiles-1));
      var res = computeResolution(state.imgScale);
      resSpan.textContent = res;
      var quality = getResQuality(res);
      warnSpan.classList.toggle("good", quality === 'good');
      warnSpan.classList.toggle("fair", quality === 'fair');
      warnSpan.classList.toggle("poor", quality === 'poor');
      face.setAttribute("src", quality + '_res.svg')
      
    });
    $id('wide_label').classList.add('active');
    $id('high_label').classList.add('active');
  }
  
  return {
    init: init
  }
  
})();

var control = (function() {

  var mouseDownFlag = false, scalingFlag = false;
  var mouseX=0, mouseY=0;

  function init() {
    app = window.app;
    var fileInput = $id('file_input');
    var image = $id('svg_img');
    var scaleButton = $id('drag_button');
    var lockSwitch = $id('lock');
    var dataURL, canvas, ctx;
    var state;
    var waiting = false;
    
    fileInput.addEventListener("change", function loadImage(e) {
      var file = fileInput.files[0];
      var imageType = /^image\//;
      
      if (file && imageType.test(file.type)) {
        waiting = true;
        setCursor();
        var img = document.createElement("img");
        img.onload = function () {
            URL.revokeObjectURL(this.src);
            canvas = document.createElement("canvas");
            canvas.width =this.width;
            canvas.height =this.height;

            ctx = canvas.getContext("2d");
            ctx.drawImage(this, 0, 0);

            dataURL = canvas.toDataURL("image/jpeg");
            app.trigger('loadImage', dataURL, this.width, this.height, file.name);
            waiting = false;
            setCursor();

        };
        img.classList.add("obj");
        img.file = file;
        
        img.src = URL.createObjectURL(file);
      }
    });
  
    var grid = $id('grid');
    var usedGrid = $id('used_path');
    var wide = $id('wide');
    var high = $id('high');
    var pdf = $id('pdf');
    var panel = $id('panel');
    var job = $id('job');
    grid.addEventListener("mousemove", mouseMove);
    grid.addEventListener("mousedown", mouseDown);
    scaleButton.addEventListener("mousedown", mouseDownScale);
    grid.addEventListener("mouseup", mouseUp);
    grid.addEventListener("mouseout", mouseOut);
    wide.addEventListener("change", setWideHigh);
    high.addEventListener("change", setWideHigh);
    pdf.addEventListener("click", createPdf);
    lockSwitch.addEventListener("change", lockChange);
    setCursor();
    
    function setCursor() {
      grid.style.cursor=waiting?"wait":"move";
      panel.style.cursor=waiting?"wait":"auto";
      pdf.style.cursor=waiting?"wait":"auto";
      fileInput.style.cursor=waiting?"wait":"auto";
    }
    app.on('update', function update(_state) {
      state=_state;
    });
  
    function subDataUrl(imgArea) {
      var subCanvas = document.createElement("canvas");
      subCanvas.width = imgArea.width;
      subCanvas.height = imgArea.height;
      var subCtx = subCanvas.getContext("2d");
      subCtx.putImageData(ctx.getImageData(imgArea.x, imgArea.y, imgArea.width, imgArea.height),0,0);
      var subDataUrl = subCanvas.toDataURL("image/jpeg");
      return subDataUrl;
    }
  
    function tileToImageArea(tileX, tileY) {
      var fromLeft = (tileX * GRID_SQUARE - state.scrollX) / state.imgScale;
      var fromTop = (tileY * GRID_SQUARE - state.scrollY) / state.imgScale;
      var size = (GRID_SQUARE + 2*MARGIN) / state.imgScale;
      return {
        x: fromLeft,
        y: fromTop,
        width: size,
        height: size
      }
    }
  
    function lockChange(e) {
      if (lockSwitch.checked) app.trigger('lock');
      else app.trigger('unlock');
    }
  
    function createPdf(e) {
      if (!ctx) return alert("Load a PNG or JPEG file first");
      waiting = true;
      setCursor();
      setTimeout(function makePdf() {
        var doc = new jsPDF('l', 'mm', [MM_PDF, MM_PDF]);
        doc.text("Job #: " + (job.value || "<unspecified>"), 10, 10);
        var row, col, numRows=state.numTilesY, numCols=state.numTilesX, imgArea, url;
        for (row=0; row<numRows; row++) {
          for (col=0; col<numCols; col++) {
            doc.addPage();
            imgArea = tileToImageArea(col, row);
            url = subDataUrl(imgArea);
            doc.addImage(url, 'JPEG', 0, 0, MM_PDF, MM_PDF);
          }
        }
        doc.save(state.fileName + ".pdf");
        waiting = false;
        setCursor();
      }, 300);
    }
  
    function setWideHigh(e) {
      var tilesWide = wide.value;
      tilesWide = Number(tilesWide);
      if (isNaN(tilesWide) || tilesWide < 1) tilesWide = 0;
      var tilesHigh = high.value;
      tilesHigh = Number(tilesHigh);
      if (isNaN(tilesHigh) || tilesHigh < 1) tilesHigh = 0;
      if (tilesHigh && tilesWide) lockSwitch.checked = true;
      app.trigger("setNumTiles", tilesWide, tilesHigh);
    }
    
    view.init(image, scaleButton, usedGrid, wide, high);
    model.init();
    
    return this;
  }
  
  //handle mouse move
  function mouseMove(e) {
    e.stopPropagation();
    if ((e.buttons & 1) === 0) mouseDownFlag = false;
    if (mouseDownFlag) return mouseDrag(e); // if mouse button down we're dragging
  }

  //handle mouse out
  function mouseOut(e) {
    e.stopPropagation();
    if ((e.buttons & 1) === 0) mouseDownFlag = false;
    if (mouseDownFlag) return mouseDrag(e); // if mouse button down we're dragging
  }
  
  //handle mouse down
  function mouseDown(e) {
    e.stopPropagation();
    mouseDownFlag = true;
    mouseX = e.pageX;
    mouseY = e.pageY;
  }
  
  //handle mouse down
  function mouseDownScale(e) {
    mouseDown(e);
    scalingFlag = true;
  }
  
  //handle mouse up
  function mouseUp(e) {
    e.stopPropagation();
    mouseDownFlag = scalingFlag = false;
  }
  
  //handle mouse move when button down
  function mouseDrag(e) {
    var deltaX = e.pageX - mouseX;
    var deltaY = e.pageY - mouseY;
    if (deltaX * deltaX + deltaY * deltaY >= MIN_DRAG_DELTA_SQUARED) {
      if (scalingFlag) app.trigger('scale', e.pageX-grid.offsetLeft-BUTTON_SIZE/2, e.pageY-grid.offsetTop-BUTTON_SIZE/2);
      else app.trigger('scroll', deltaX, deltaY);
      mouseX = e.pageX;
      mouseY = e.pageY;
    }
  }
  
  return {
    init: init
  }
  
})();

return {
 init: control.init
};

})();