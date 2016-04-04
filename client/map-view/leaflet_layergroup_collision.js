function rbush(maxEntries, format) {

    // jshint newcap: false, validthis: true
    if (!(this instanceof rbush)) return new rbush(maxEntries, format);

    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries || 9);
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));

    if (format) {
        this._initFormat(format);
    }

    this.clear();
}

rbush.prototype = {

    all: function () {
        return this._all(this.data, []);
    },

    search: function (bbox) {

        var node = this.data,
            result = [],
            toBBox = this.toBBox;

        if (!intersects(bbox, node.bbox)) return result;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child.bbox;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf) result.push(child);
                    else if (contains(bbox, childBBox)) this._all(child, result);
                    else nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return result;
    },

    collides: function (bbox) {

        var node = this.data,
            toBBox = this.toBBox;

        if (!intersects(bbox, node.bbox)) return false;

        var nodesToSearch = [],
            i, len, child, childBBox;

        while (node) {
            for (i = 0, len = node.children.length; i < len; i++) {

                child = node.children[i];
                childBBox = node.leaf ? toBBox(child) : child.bbox;

                if (intersects(bbox, childBBox)) {
                    if (node.leaf || contains(bbox, childBBox)) return true;
                    nodesToSearch.push(child);
                }
            }
            node = nodesToSearch.pop();
        }

        return false;
    },

    load: function (data) {
        if (!(data && data.length)) return this;

        if (data.length < this._minEntries) {
            for (var i = 0, len = data.length; i < len; i++) {
                this.insert(data[i]);
            }
            return this;
        }

        // recursively build the tree with the given data from stratch using OMT algorithm
        var node = this._build(data.slice(), 0, data.length - 1, 0);

        if (!this.data.children.length) {
            // save as is if tree is empty
            this.data = node;

        } else if (this.data.height === node.height) {
            // split root if trees have the same height
            this._splitRoot(this.data, node);

        } else {
            if (this.data.height < node.height) {
                // swap trees if inserted one is bigger
                var tmpNode = this.data;
                this.data = node;
                node = tmpNode;
            }

            // insert the small tree into the large tree at appropriate level
            this._insert(node, this.data.height - node.height - 1, true);
        }

        return this;
    },

    insert: function (item) {
        if (item) this._insert(item, this.data.height - 1);
        return this;
    },

    clear: function () {
        this.data = {
            children: [],
            height: 1,
            bbox: empty(),
            leaf: true
        };
        return this;
    },

    remove: function (item) {
        if (!item) return this;

        var node = this.data,
            bbox = this.toBBox(item),
            path = [],
            indexes = [],
            i, parent, index, goingUp;

        // depth-first iterative tree traversal
        while (node || path.length) {

            if (!node) { // go up
                node = path.pop();
                parent = path[path.length - 1];
                i = indexes.pop();
                goingUp = true;
            }

            if (node.leaf) { // check current node
                index = node.children.indexOf(item);

                if (index !== -1) {
                    // item found, remove the item and condense tree upwards
                    node.children.splice(index, 1);
                    path.push(node);
                    this._condense(path);
                    return this;
                }
            }

            if (!goingUp && !node.leaf && contains(node.bbox, bbox)) { // go down
                path.push(node);
                indexes.push(i);
                i = 0;
                parent = node;
                node = node.children[0];

            } else if (parent) { // go right
                i++;
                node = parent.children[i];
                goingUp = false;

            } else node = null; // nothing found
        }

        return this;
    },

    toBBox: function (item) { return item; },

    compareMinX: function (a, b) { return a[0] - b[0]; },
    compareMinY: function (a, b) { return a[1] - b[1]; },

    toJSON: function () { return this.data; },

    fromJSON: function (data) {
        this.data = data;
        return this;
    },

    _all: function (node, result) {
        var nodesToSearch = [];
        while (node) {
            if (node.leaf) result.push.apply(result, node.children);
            else nodesToSearch.push.apply(nodesToSearch, node.children);

            node = nodesToSearch.pop();
        }
        return result;
    },

    _build: function (items, left, right, height) {

        var N = right - left + 1,
            M = this._maxEntries,
            node;

        if (N <= M) {
            // reached leaf level; return leaf
            node = {
                children: items.slice(left, right + 1),
                height: 1,
                bbox: null,
                leaf: true
            };
            calcBBox(node, this.toBBox);
            return node;
        }

        if (!height) {
            // target height of the bulk-loaded tree
            height = Math.ceil(Math.log(N) / Math.log(M));

            // target number of root entries to maximize storage utilization
            M = Math.ceil(N / Math.pow(M, height - 1));
        }

        node = {
            children: [],
            height: height,
            bbox: null,
            leaf: false
        };

        // split the items into M mostly square tiles

        var N2 = Math.ceil(N / M),
            N1 = N2 * Math.ceil(Math.sqrt(M)),
            i, j, right2, right3;

        multiSelect(items, left, right, N1, this.compareMinX);

        for (i = left; i <= right; i += N1) {

            right2 = Math.min(i + N1 - 1, right);

            multiSelect(items, i, right2, N2, this.compareMinY);

            for (j = i; j <= right2; j += N2) {

                right3 = Math.min(j + N2 - 1, right2);

                // pack each entry recursively
                node.children.push(this._build(items, j, right3, height - 1));
            }
        }

        calcBBox(node, this.toBBox);

        return node;
    },

    _chooseSubtree: function (bbox, node, level, path) {

        var i, len, child, targetNode, area, enlargement, minArea, minEnlargement;

        while (true) {
            path.push(node);

            if (node.leaf || path.length - 1 === level) break;

            minArea = minEnlargement = Infinity;

            for (i = 0, len = node.children.length; i < len; i++) {
                child = node.children[i];
                area = bboxArea(child.bbox);
                enlargement = enlargedArea(bbox, child.bbox) - area;

                // choose entry with the least area enlargement
                if (enlargement < minEnlargement) {
                    minEnlargement = enlargement;
                    minArea = area < minArea ? area : minArea;
                    targetNode = child;

                } else if (enlargement === minEnlargement) {
                    // otherwise choose one with the smallest area
                    if (area < minArea) {
                        minArea = area;
                        targetNode = child;
                    }
                }
            }

            node = targetNode;
        }

        return node;
    },

    _insert: function (item, level, isNode) {

        var toBBox = this.toBBox,
            bbox = isNode ? item.bbox : toBBox(item),
            insertPath = [];

        // find the best node for accommodating the item, saving all nodes along the path too
        var node = this._chooseSubtree(bbox, this.data, level, insertPath);

        // put the item into the node
        node.children.push(item);
        extend(node.bbox, bbox);

        // split on node overflow; propagate upwards if necessary
        while (level >= 0) {
            if (insertPath[level].children.length > this._maxEntries) {
                this._split(insertPath, level);
                level--;
            } else break;
        }

        // adjust bboxes along the insertion path
        this._adjustParentBBoxes(bbox, insertPath, level);
    },

    // split overflowed node into two
    _split: function (insertPath, level) {

        var node = insertPath[level],
            M = node.children.length,
            m = this._minEntries;

        this._chooseSplitAxis(node, m, M);

        var splitIndex = this._chooseSplitIndex(node, m, M);

        var newNode = {
            children: node.children.splice(splitIndex, node.children.length - splitIndex),
            height: node.height,
            bbox: null,
            leaf: false
        };

        if (node.leaf) newNode.leaf = true;

        calcBBox(node, this.toBBox);
        calcBBox(newNode, this.toBBox);

        if (level) insertPath[level - 1].children.push(newNode);
        else this._splitRoot(node, newNode);
    },

    _splitRoot: function (node, newNode) {
        // split root node
        this.data = {
            children: [node, newNode],
            height: node.height + 1,
            bbox: null,
            leaf: false
        };
        calcBBox(this.data, this.toBBox);
    },

    _chooseSplitIndex: function (node, m, M) {

        var i, bbox1, bbox2, overlap, area, minOverlap, minArea, index;

        minOverlap = minArea = Infinity;

        for (i = m; i <= M - m; i++) {
            bbox1 = distBBox(node, 0, i, this.toBBox);
            bbox2 = distBBox(node, i, M, this.toBBox);

            overlap = intersectionArea(bbox1, bbox2);
            area = bboxArea(bbox1) + bboxArea(bbox2);

            // choose distribution with minimum overlap
            if (overlap < minOverlap) {
                minOverlap = overlap;
                index = i;

                minArea = area < minArea ? area : minArea;

            } else if (overlap === minOverlap) {
                // otherwise choose distribution with minimum area
                if (area < minArea) {
                    minArea = area;
                    index = i;
                }
            }
        }

        return index;
    },

    // sorts node children by the best axis for split
    _chooseSplitAxis: function (node, m, M) {

        var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX,
            compareMinY = node.leaf ? this.compareMinY : compareNodeMinY,
            xMargin = this._allDistMargin(node, m, M, compareMinX),
            yMargin = this._allDistMargin(node, m, M, compareMinY);

        // if total distributions margin value is minimal for x, sort by minX,
        // otherwise it's already sorted by minY
        if (xMargin < yMargin) node.children.sort(compareMinX);
    },

    // total margin of all possible split distributions where each node is at least m full
    _allDistMargin: function (node, m, M, compare) {

        node.children.sort(compare);

        var toBBox = this.toBBox,
            leftBBox = distBBox(node, 0, m, toBBox),
            rightBBox = distBBox(node, M - m, M, toBBox),
            margin = bboxMargin(leftBBox) + bboxMargin(rightBBox),
            i, child;

        for (i = m; i < M - m; i++) {
            child = node.children[i];
            extend(leftBBox, node.leaf ? toBBox(child) : child.bbox);
            margin += bboxMargin(leftBBox);
        }

        for (i = M - m - 1; i >= m; i--) {
            child = node.children[i];
            extend(rightBBox, node.leaf ? toBBox(child) : child.bbox);
            margin += bboxMargin(rightBBox);
        }

        return margin;
    },

    _adjustParentBBoxes: function (bbox, path, level) {
        // adjust bboxes along the given tree path
        for (var i = level; i >= 0; i--) {
            extend(path[i].bbox, bbox);
        }
    },

    _condense: function (path) {
        // go through the path, removing empty nodes and updating bboxes
        for (var i = path.length - 1, siblings; i >= 0; i--) {
            if (path[i].children.length === 0) {
                if (i > 0) {
                    siblings = path[i - 1].children;
                    siblings.splice(siblings.indexOf(path[i]), 1);

                } else this.clear();

            } else calcBBox(path[i], this.toBBox);
        }
    },

    _initFormat: function (format) {
        // data format (minX, minY, maxX, maxY accessors)

        // uses eval-type function compilation instead of just accepting a toBBox function
        // because the algorithms are very sensitive to sorting functions performance,
        // so they should be dead simple and without inner calls

        // jshint evil: true

        var compareArr = ['return a', ' - b', ';'];

        this.compareMinX = new Function('a', 'b', compareArr.join(format[0]));
        this.compareMinY = new Function('a', 'b', compareArr.join(format[1]));

        this.toBBox = new Function('a', 'return [a' + format.join(', a') + '];');
    }
};


// calculate node's bbox from bboxes of its children
function calcBBox(node, toBBox) {
    node.bbox = distBBox(node, 0, node.children.length, toBBox);
}

// min bounding rectangle of node children from k to p-1
function distBBox(node, k, p, toBBox) {
    var bbox = empty();

    for (var i = k, child; i < p; i++) {
        child = node.children[i];
        extend(bbox, node.leaf ? toBBox(child) : child.bbox);
    }

    return bbox;
}

function empty() { return [Infinity, Infinity, -Infinity, -Infinity]; }

function extend(a, b) {
    a[0] = Math.min(a[0], b[0]);
    a[1] = Math.min(a[1], b[1]);
    a[2] = Math.max(a[2], b[2]);
    a[3] = Math.max(a[3], b[3]);
    return a;
}

function compareNodeMinX(a, b) { return a.bbox[0] - b.bbox[0]; }
function compareNodeMinY(a, b) { return a.bbox[1] - b.bbox[1]; }

function bboxArea(a)   { return (a[2] - a[0]) * (a[3] - a[1]); }
function bboxMargin(a) { return (a[2] - a[0]) + (a[3] - a[1]); }

function enlargedArea(a, b) {
    return (Math.max(b[2], a[2]) - Math.min(b[0], a[0])) *
           (Math.max(b[3], a[3]) - Math.min(b[1], a[1]));
}

function intersectionArea(a, b) {
    var minX = Math.max(a[0], b[0]),
        minY = Math.max(a[1], b[1]),
        maxX = Math.min(a[2], b[2]),
        maxY = Math.min(a[3], b[3]);

    return Math.max(0, maxX - minX) *
           Math.max(0, maxY - minY);
}

function contains(a, b) {
    return a[0] <= b[0] &&
           a[1] <= b[1] &&
           b[2] <= a[2] &&
           b[3] <= a[3];
}

function intersects(a, b) {
    return b[0] <= a[2] &&
           b[1] <= a[3] &&
           b[2] >= a[0] &&
           b[3] >= a[1];
}

// sort an array so that items come in groups of n unsorted items, with groups sorted between each other;
// combines selection algorithm with binary divide & conquer approach

function multiSelect(arr, left, right, n, compare) {
    var stack = [left, right],
        mid;

    while (stack.length) {
        right = stack.pop();
        left = stack.pop();

        if (right - left <= n) continue;

        mid = left + Math.ceil((right - left) / n / 2) * n;
        select(arr, left, right, mid, compare);

        stack.push(left, mid, mid, right);
    }
}

// Floyd-Rivest selection algorithm:
// sort an array between left and right (inclusive) so that the smallest k elements come first (unordered)
function select(arr, left, right, k, compare) {
    var n, i, z, s, sd, newLeft, newRight, t, j;

    while (right > left) {
        if (right - left > 600) {
            n = right - left + 1;
            i = k - left + 1;
            z = Math.log(n);
            s = 0.5 * Math.exp(2 * z / 3);
            sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (i - n / 2 < 0 ? -1 : 1);
            newLeft = Math.max(left, Math.floor(k - i * s / n + sd));
            newRight = Math.min(right, Math.floor(k + (n - i) * s / n + sd));
            select(arr, newLeft, newRight, k, compare);
        }

        t = arr[k];
        i = left;
        j = right;

        swap(arr, left, k);
        if (compare(arr[right], t) > 0) swap(arr, left, right);

        while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare(arr[i], t) < 0) i++;
            while (compare(arr[j], t) > 0) j--;
        }

        if (compare(arr[left], t) === 0) swap(arr, left, j);
        else {
            j++;
            swap(arr, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}


// export as AMD/CommonJS module or global variable
if (typeof define === 'function' && define.amd) define('rbush', function () { return rbush; });
else if (typeof module !== 'undefined') module.exports = rbush;
else if (typeof self !== 'undefined') self.rbush = rbush;
else window.rbush = rbush;

var isMSIE8 = !('getComputedStyle' in window && typeof window.getComputedStyle === 'function')

function extensions(parentClass) { return {

	_originalLayers: [],
	_visibleLayers: [],
	_staticLayers: [],
	_rbush: [],
	_cachedRelativeBoxes: [],
	_margin: 0,

	initialize: function (options) {
		parentClass.prototype.initialize.call(this, options);
		this._margin = options.margin || 0;
		this._rbush = null;
	},

	addLayer: function(layer) {
        /*
		if ( !('options' in layer) || !('icon' in layer.options)) {
			this._staticLayers.push(layer);
			parentClass.prototype.addLayer.call(this, layer);
			return;
		}
		*/

		for (var i=0; i< layer.length;i++) {
            this._staticLayers.push(layer[i]);
            parentClass.prototype.addLayer.call(this, layer[i]);
		}

        //this._staticLayers.push(layer);
		//parentClass.prototype.addLayer.call(this, layer);
		return;

		this._originalLayers.push(layer);
		if (this._map) {
			this._maybeAddLayerToRBush( layer );
		}
	},

	removeLayer: function(layer) {
		this._rbush.remove(this._cachedRelativeBoxes[layer._leaflet_id]);
		delete this._cachedRelativeBoxes[layer._leaflet_id];
		parentClass.prototype.removeLayer.call(this,layer);
		var i;

		i = this._originalLayers.indexOf(layer);
		if (i !== -1) { this._originalLayers.splice(i,1); }

		i = this._visibleLayers.indexOf(layer);
		if (i !== -1) { this._visibleLayers.splice(i,1); }

		i = this._staticLayers.indexOf(layer);
		if (i !== -1) { this._staticLayers.splice(i,1); }
	},

	clearLayers: function() {
		this._rbush = rbush();
		this._originalLayers = [];
		this._visibleLayers  = [];
		this._staticLayers   = [];
		this._cachedRelativeBoxes = [];
		parentClass.prototype.clearLayers.call(this);
	},

	onAdd: function (map) {
		this._map = map;

		for (var i in this._staticLayers) {
			map.addLayer(this._staticLayers[i]);
		}

		this._onZoomEnd();
		map.on('zoomend', this._onZoomEnd, this);
	},

	onRemove: function(map) {
		for (var i in this._staticLayers) {
			map.removeLayer(this._staticLayers[i]);
		}
		map.off('zoomend', this._onZoomEnd, this);
		parentClass.prototype.onRemove.call(this, map);
	},

	_maybeAddLayerToRBush: function(layer) {
        console.log("zoom" , layer);
		var z    = this._map.getZoom();
		var bush = this._rbush;

		var boxes = this._cachedRelativeBoxes[layer._leaflet_id];
		var visible = false;
		if (!boxes) {
			// Add the layer to the map so it's instantiated on the DOM,
			//   in order to fetch its position and size.
			parentClass.prototype.addLayer.call(this, layer);
			var visible = true;
// 			var htmlElement = layer._icon;
			var box = this._getIconBox(layer._icon);
			boxes = this._getRelativeBoxes(layer._icon.children, box);
			boxes.push(box);
			this._cachedRelativeBoxes[layer._leaflet_id] = boxes;
		}

		boxes = this._positionBoxes(this._map.latLngToLayerPoint(layer.getLatLng()),boxes);

        console.log("boxes ->" , boxes);
		var collision = false;
		for (var i=0; i<boxes.length && !collision; i++) {
			collision = bush.search(boxes[i]).length > 0;
		}

		if (!collision) {
			if (!visible) {
				parentClass.prototype.addLayer.call(this, layer);
			}
			this._visibleLayers.push(layer);
			bush.load(boxes);
		} else {
			parentClass.prototype.removeLayer.call(this, layer);
		}
	},


	// Returns a plain array with the relative dimensions of a L.Icon, based
	//   on the computed values from iconSize and iconAnchor.
	_getIconBox: function (el) {

		if (isMSIE8) {
			// Fallback for MSIE8, will most probably fail on edge cases
			return [ 0, 0, el.offsetWidth, el.offsetHeight];
		}

		var styles = window.getComputedStyle(el);

		// getComputedStyle() should return values already in pixels, so using parseInt()
		//   is not as much as a hack as it seems to be.

		return [
			parseInt(styles.marginLeft),
			parseInt(styles.marginTop),
			parseInt(styles.marginLeft) + parseInt(styles.width),
			parseInt(styles.marginTop)  + parseInt(styles.height)
		];
	},


	// Much like _getIconBox, but works for positioned HTML elements, based on offsetWidth/offsetHeight.
	_getRelativeBoxes: function(els,baseBox) {
		var boxes = [];
		for (var i=0; i<els.length; i++) {
			var el = els[i];
			var box = [
				el.offsetLeft,
				el.offsetTop,
				el.offsetLeft + el.offsetWidth,
				el.offsetTop  + el.offsetHeight
			];
			box = this._offsetBoxes(box, baseBox);
			boxes.push( box );

			if (el.children.length) {
				var parentBox = baseBox;
				if (!isMSIE8) {
					var positionStyle = window.getComputedStyle(el).position;
					if (positionStyle === 'absolute' || positionStyle === 'relative') {
						parentBox = box;
					}
				}
				boxes = boxes.concat( this._getRelativeBoxes(el.children, parentBox) );
			}
		}
		return boxes;
	},

	_offsetBoxes: function(a,b){
		return [
			a[0] + b[0],
			a[1] + b[1],
			a[2] + b[0],
			a[3] + b[1]
		];
	},

	// Adds the coordinate of the layer (in pixels / map canvas units) to each box coordinate.
	_positionBoxes: function(offset, boxes) {
		var newBoxes = [];	// Must be careful to not overwrite references to the original ones.
		for (var i=0; i<boxes.length; i++) {
			newBoxes.push( this._positionBox( offset, boxes[i] ) );
		}
		return newBoxes;
	},

	_positionBox: function(offset, box) {

		return [
			box[0] + offset.x - this._margin,
			box[1] + offset.y - this._margin,
			box[2] + offset.x + this._margin,
			box[3] + offset.y + this._margin,
		]
	},

	_onZoomEnd: function() {

		for (var i=0; i<this._visibleLayers.length; i++) {
			parentClass.prototype.removeLayer.call(this, this._visibleLayers[i]);
		}

		this._rbush = rbush();

		for (var i=0; i < this._originalLayers.length; i++) {
			this._maybeAddLayerToRBush(this._originalLayers[i]);
		}

	}
}};


L.LayerGroup.Collision   = L.LayerGroup.extend(extensions( L.LayerGroup ));
L.FeatureGroup.Collision = L.FeatureGroup.extend(extensions( L.FeatureGroup ));
L.GeoJSON.Collision      = L.GeoJSON.extend(extensions( L.GeoJSON ));

// Uppercase factories only for backwards compatibility:
L.LayerGroup.collision = function (options) {
	return new L.LayerGroup.Collision(options || {});
};

L.FeatureGroup.collision = function (options) {
	return new L.FeatureGroup.Collision(options || {});
};

L.GeoJSON.collision = function (options) {
	return new L.GeoJSON.Collision(options || {});
};

// Factories should always be lowercase, like this:
L.layerGroup.collision = function (options) {
	return new L.LayerGroup.Collision(options || {});
};

L.featureGroup.collision = function (options) {
	return new L.FeatureGroup.Collision(options || {});
};

L.geoJson.collision = function (options) {
	return new L.GeoJSON.Collision(options || {});
};

