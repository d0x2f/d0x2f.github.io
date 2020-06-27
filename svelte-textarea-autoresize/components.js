var components = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const sum = (...summands) =>
      summands.map(parseFloat).reduce((a, b) => a + b, 0);

    const isIE =
      typeof document !== 'undefined'
        ? !!document.documentElement.currentStyle
        : false;

    const pick = (obj, keys) =>
      keys.reduce((acc, key) => {
        acc[key] = obj[key];
        return acc
      }, {});

    const clean = (props) => {
      const { children, $$scope, $$slots, ...rest } = props;
      return rest
    };

    const SIZING_STYLE = [
      'borderBottomWidth',
      'borderLeftWidth',
      'borderRightWidth',
      'borderTopWidth',
      'boxSizing',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      // non-standard
      'tabSize',
      'textIndent',
      // non-standard
      'textRendering',
      'textTransform',
      'width',
    ];

    function getSizingData(node) {
      const style = window.getComputedStyle(node);

      if (style === null) {
        return null
      }

      let sizingStyle = pick(style, SIZING_STYLE);
      const { boxSizing } = sizingStyle;

      // probably node is detached from DOM, can't read computed dimensions
      if (boxSizing === '') {
        return null
      }

      // IE (Edge has already correct behaviour) returns content width as computed width
      // so we need to add manually padding and border widths
      if (isIE && boxSizing === 'border-box') {
        sizingStyle.width =
          sum(
            sizingStyle.width,
            sizingStyle.borderRightWidth,
            sizingStyle.borderLeftWidth,
            sizingStyle.paddingRight,
            sizingStyle.paddingLeft,
          ) + 'px';
      }

      const paddingSize = sum(sizingStyle.paddingBottom, sizingStyle.paddingTop);

      const borderSize = sum(
        sizingStyle.borderBottomWidth,
        sizingStyle.borderTopWidth,
      );

      return {
        sizingStyle,
        paddingSize,
        borderSize,
      }
    }

    const HIDDEN_TEXTAREA_STYLE = {
      'min-height': '0',
      'max-height': 'none',
      // height: "0",
      visibility: 'hidden',
      overflow: 'hidden',
      position: 'absolute',
      'z-index': '-1000',
      top: '0',
      right: '0',
    };

    function forceHiddenStyles(node) {
      return Object.entries(HIDDEN_TEXTAREA_STYLE).forEach(([key, value]) =>
        node.style.setProperty(key, value, 'important'),
      )
    }

    let hiddenTextarea;

    const getHeight = (node, sizingData) => {
      const height = node.scrollHeight;
      if (sizingData.sizingStyle.boxSizing === 'border-box') {
        // border-box: add border, since height = content + padding + border
        return height + sizingData.borderSize
      }

      // remove padding, since height = content
      return height - sizingData.paddingSize
    };

    function calculateNodeHeight(sizingData, value) {
      if (!hiddenTextarea) {
        hiddenTextarea = document.createElement('textarea');
        hiddenTextarea.setAttribute('tab-index', '-1');
        hiddenTextarea.setAttribute('aria-hidden', 'true');
        hiddenTextarea.setAttribute('rows', '1');
        forceHiddenStyles(hiddenTextarea);
      }

      if (hiddenTextarea.parentNode === null) {
        document.body.appendChild(hiddenTextarea);
      }

      const { paddingSize, borderSize, sizingStyle } = sizingData;
      const { boxSizing } = sizingStyle;

      Object.entries(sizingStyle).forEach(
        ([key, value]) => (hiddenTextarea.style[key] = value),
      );

      forceHiddenStyles(hiddenTextarea);

      hiddenTextarea.value = value;
      let height = getHeight(hiddenTextarea, sizingData);

      // measure height of a textarea with a single row
      hiddenTextarea.value = 'x';
      const rowHeight = hiddenTextarea.scrollHeight - paddingSize;

      let minHeight = rowHeight;
      if (boxSizing === 'border-box') {
        minHeight = minHeight + paddingSize + borderSize;
      }
      return Math.max(minHeight, height)
    }

    function autoresize(node) {
      const resize = () => {
        const nodeSizingData = getSizingData(node);

        if (!nodeSizingData) {
          return
        }

        const height = calculateNodeHeight(
          nodeSizingData,
          node.value || node.placeholder || 'x',
        );
        node.style.setProperty('height', `${height}px`, 'important');
      };
      node.addEventListener('input', resize);
      window.addEventListener('resize', resize);
      resize();
    }

    /* src/AutoresizingTextAreaComponent/index.svelte generated by Svelte v3.23.2 */
    const file = "src/AutoresizingTextAreaComponent/index.svelte";

    function create_fragment(ctx) {
    	let textarea;
    	let autoresize_action;
    	let mounted;
    	let dispose;
    	let textarea_levels = [/*props*/ ctx[0]];
    	let textarea_data = {};

    	for (let i = 0; i < textarea_levels.length; i += 1) {
    		textarea_data = assign(textarea_data, textarea_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			set_attributes(textarea, textarea_data);
    			add_location(textarea, file, 7, 0, 126);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);

    			if (!mounted) {
    				dispose = action_destroyer(autoresize_action = autoresize.call(null, textarea));
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			set_attributes(textarea, textarea_data = get_spread_update(textarea_levels, [dirty & /*props*/ 1 && /*props*/ ctx[0]]));
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	const props = clean($$props);
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("AutoresizingTextAreaComponent", $$slots, []);

    	$$self.$set = $$new_props => {
    		$$invalidate(1, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    	};

    	$$self.$capture_state = () => ({ autoresize, clean, props });

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(1, $$props = assign(assign({}, $$props), $$new_props));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$props = exclude_internal_props($$props);
    	return [props];
    }

    class AutoresizingTextAreaComponent extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AutoresizingTextAreaComponent",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/App.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-1mzs3la-style";
    	style.textContent = "#textarea.svelte-1mzs3la{width:200px;resize:none;border-width:2px;border-radius:5px;border-style:solid;border-color:#0066;padding:8px;box-sizing:border-box}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgQXV0b3Jlc2l6aW5nVGV4dEFyZWEsIHsgYXV0b3Jlc2l6ZSB9IGZyb20gJy4vaW5kZXgnXG48L3NjcmlwdD5cblxuPHN0eWxlPlxuI3RleHRhcmVhIHtcbiAgd2lkdGg6IDIwMHB4O1xuICByZXNpemU6IG5vbmU7XG4gIGJvcmRlci13aWR0aDogMnB4O1xuICBib3JkZXItcmFkaXVzOiA1cHg7XG4gIGJvcmRlci1zdHlsZTogc29saWQ7XG4gIGJvcmRlci1jb2xvcjogIzAwNjY7XG4gIHBhZGRpbmc6IDhweDtcbiAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbn1cbjwvc3R5bGU+XG5cbjxoMT5TdmVsdGUgVGV4dGFyZWEgQXV0b3Jlc2l6ZTwvaDE+XG48cD5BbiBhdXRvbWF0aWNhbGx5IHJlc2l6aW5nIHRleHRhcmVhIGRlcGVuZGlnbiBvbiBpdCdzIGNvbnRlbnQuPC9wPlxuPHA+XG4gIDxhIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vZDB4MmYvc3ZlbHRlLXRleHRhcmVhLWF1dG9yZXNpemVcIj5HaXRIdWI8L2E+XG4gIDxhIGhyZWY9XCJodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9zdmVsdGUtdGV4dGFyZWEtYXV0b3Jlc2l6ZVwiPk5QTTwvYT5cbjwvcD5cblxuPGgyPkV4YW1wbGU8L2gyPlxuPHA+VHlwZSBhIGxvbmcgc3RyaW5nIGludG8gdGhlIGJveCBiZWxsb3cgYW5kIGl0J2xsIGNoYW5nZSBpbiBoZWlnaHQgYXV0b21hdGljYWxseSBhcyB5b3UgdHlwZS48L3A+XG48dGV4dGFyZWFcbiAgdXNlOmF1dG9yZXNpemVcbiAgaWQ9XCJ0ZXh0YXJlYVwiXG4gIHBsYWNlaG9sZGVyPVwiVHlwZSBzb21ldGhpbmcgbG9uZy4uXCJcbi8+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBS0EsU0FBUyxlQUFDLENBQUMsQUFDVCxLQUFLLENBQUUsS0FBSyxDQUNaLE1BQU0sQ0FBRSxJQUFJLENBQ1osWUFBWSxDQUFFLEdBQUcsQ0FDakIsYUFBYSxDQUFFLEdBQUcsQ0FDbEIsWUFBWSxDQUFFLEtBQUssQ0FDbkIsWUFBWSxDQUFFLEtBQUssQ0FDbkIsT0FBTyxDQUFFLEdBQUcsQ0FDWixVQUFVLENBQUUsVUFBVSxBQUN4QixDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let a0;
    	let t5;
    	let a1;
    	let t7;
    	let h2;
    	let t9;
    	let p2;
    	let t11;
    	let textarea;
    	let autoresize_action;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Svelte Textarea Autoresize";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "An automatically resizing textarea dependign on it's content.";
    			t3 = space();
    			p1 = element("p");
    			a0 = element("a");
    			a0.textContent = "GitHub";
    			t5 = space();
    			a1 = element("a");
    			a1.textContent = "NPM";
    			t7 = space();
    			h2 = element("h2");
    			h2.textContent = "Example";
    			t9 = space();
    			p2 = element("p");
    			p2.textContent = "Type a long string into the box bellow and it'll change in height automatically as you type.";
    			t11 = space();
    			textarea = element("textarea");
    			add_location(h1, file$1, 17, 0, 276);
    			add_location(p0, file$1, 18, 0, 312);
    			attr_dev(a0, "href", "https://github.com/d0x2f/svelte-textarea-autoresize");
    			add_location(a0, file$1, 20, 2, 387);
    			attr_dev(a1, "href", "https://www.npmjs.com/package/svelte-textarea-autoresize");
    			add_location(a1, file$1, 21, 2, 462);
    			add_location(p1, file$1, 19, 0, 381);
    			add_location(h2, file$1, 24, 0, 543);
    			add_location(p2, file$1, 25, 0, 560);
    			attr_dev(textarea, "id", "textarea");
    			attr_dev(textarea, "placeholder", "Type something long..");
    			attr_dev(textarea, "class", "svelte-1mzs3la");
    			add_location(textarea, file$1, 26, 0, 660);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, a0);
    			append_dev(p1, t5);
    			append_dev(p1, a1);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, p2, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, textarea, anchor);

    			if (!mounted) {
    				dispose = action_destroyer(autoresize_action = autoresize.call(null, textarea));
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ AutoresizingTextArea: AutoresizingTextAreaComponent, autoresize });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1mzs3la-style")) add_css();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    // for testing

    const app = new App({
      target: document.body,
    });

    return app;

}());
