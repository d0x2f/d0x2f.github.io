+++
title = "Using Zola to Build a Blog"
description = "Zola is a static site generator written in Rust that includes all the bells and whistles built in. This post explores how to set up an initial basic blog site."
date = "2025-04-06"

[taxonomies]
tags = ["zola", "web", "markdown"]

[extra]
author = "Dylan McGannon"
+++

As an avid crustacean, when I look for something new to use, I google "\<thing I want\> rust". And so, when I needed a static site generator, I was introduced to [Zola](https://www.getzola.org/).

At first, it was a bit confusing to understand how a project was meant to be organised. There are a lot of default folders and the quick start guide told you where to create what, but it wasn't clear (to me at least) why.

In this post, I'll aim to give an overview of how to build a simple blog site like this one using Zola.

## Installation

To begin with, install Zola on your machine. I'm an arch linux user (btw), so I installed it with pacman:

```sh
$ pacman -S zola
```

You can find instructions for other platforms in the official Zola documentation [here](https://www.getzola.org/documentation/getting-started/installation/).

## Initialising a Site Project

With Zola installed, we can now initialise a project using:

```sh
$ zola init myblog
```

This will start a wizard where you can select which features to enable for your site.

> What is the URL of your site? (https://example.com):

This will set the `base_url` configuration option in your generated `config.toml` file which can be referenced in your page (more on that later).

> Do you want to enable Sass compilation? [Y/n]:

If you want to use Sass to compile CSS, you can enable it. If you've never used it before and don't know what it is, I think it's best to enable it and learn what it does. It's basically CSS with variables, imports and functions.

> Do you want to enable syntax highlighting? [y/N]:

Of course you do.

> Do you want to build a search index of the content? [y/N]:

At this point I was thinking "why not?". What this does is set the `build_search_index` config option to true, which, when your site is compiled, will include a generated search index javascript file in the built website. You can use this search index in your templates to filter and find articles with a search box.

Note that all these questions simply set a config option. There's no complicated dependency fetching, version compatibility issues, vulnerability reports and everything else you may have stressed about with dynamic front-end frameworks. Everything you choose to enable is provided by and built-in to Zola.

After this, a bare-bones site will be created in the `myblog` folder with this structure:

```
myblog/
├── config.toml
├── content
├── sass
├── static
├── templates
└── themes
```

Let's break down what each file and folder is for.

## Writing the Code

### config.toml

```toml,name=config.toml
# The URL the site will be built for
base_url = "https://example.com"

# Whether to automatically compile all Sass files in the sass directory
compile_sass = true

# Whether to build a search index to be used later on by a JavaScript library
build_search_index = true

[markdown]
# Whether to do syntax highlighting
# Theme can be customised by setting the `highlight_theme` variable to a theme supported by Zola
highlight_code = true

[extra]
# Put all your custom variables here
```

This is your config file that was generated from your answers to the wizard. I'm going to add a title option in the config that I can reference in a template later.

Add this to the top of the `config.toml`:

```toml,name=config.toml
title = "My Blog"
```

### content/

This is where you'll put your articles as markdown files. Let's add an example.

`content/my-first-article.md`

```md,name=content/my-first-article.md
+++
title = "My First Article"
date = "2025-04-07"
+++

It all began with...
```

There's some special sauce to markdown files in Zola. Notice the section wrapped in `+++`, that's a block used to define metadata about the article. These metadata attributes will be accessible in our HTML templates.

### sass/

This folder holds your `.scss` or `.sass` files.

Files in this folder will be compiled and rendered to plain `.css` files that you can reference in your templates.

You can add `_` prefix to the filename to prevent it being compiled into a `.css` file. But you can still `@import` it in other Sass files.

Let's add some Sass files:

`sass/_variables.scss`

```scss,name=sass/_variables.scss
$background-color: #111;
$primary-color: #888;
```

`sass/style.scss`

```scss,name=sass/style.scss
@import "variables";

body {
  background-color: $background-color;
  color: $primary-color;
}
```

### static/

Here is where you'll place static files to include in your generated site. This might be images, audio, javascript etc.

Let's include a `favicon.png` file to act as our site's thumbnail.

`static/favicon.png`

{{ image(path="using-zola-to-build-a-blog/faviduck.png", width=100, height=100, op="fit", class="transparent-bg") }}

### templates/

In this folder we need to create the html templates that will put our site together.

The first file we'll create is `index.html`, which acts as the entrypoint to our website.

`templates/index.html`

```xml,name=templates/index.html
<!DOCTYPE html>
<html lang="{{ lang }}">

<head>
  <title>{% block title %}{{/* config.title */}}{% endblock title %}</title>

  <link rel="stylesheet" href="{{/* get_url(path='style.css', trailing_slash=false) */}}">
  <link rel="icon" href="/favicon.png" type="image/png">
</head>

<body>
  {% block header_title %}
  <a href="{{ config.base_url }}">
    <h1>
      {{ config.title }}
    </h1>
  </a>
  {% endblock header_title %}

  <div>
    {% block content %}
    {% for page in section.pages | reverse %}
    <div>
      <span>{{ page.date | date(format="%-d %b %Y") }}</span>
      <span>
        <a href="{{ page.permalink }}">
          {{ page.title | safe }}
        </a>
      </span>
    </div>
    {% endfor %}
    {% endblock content %}
  </div>
</body>

</html>
```

There are a number of things to talk about in this file, let's go over them.

> {{ lang }}

The `lang` variable holds the language of the current page, if specified, or `default_lang`, which in turn, defaults to `en`.

> {% block title %}{{/* config.title */}}{% endblock title %}

This represents a template block that can be replaced in by inheriting pages. For `index.html` we'll set the title to our site title "My Blog". As we'll see later, this block will be replaced with the title of the article in `page.html`.

> {{/* get_url(path='style.css', trailing_slash=false) */}}

Here we see a call to what's referred to as a "short-code", which you can think of as template functions. This one comes out of the box with Zola, but you can define your own in `templates/shortcodes`.

> {% for page in section.pages | reverse %}

I won't explain what a for loop is, but you may be puzzled by the `section.pages` variable, what is it and where did it come from? In Zola pages are organised into sections represented as subdirectories in the `content/` folder. For this minimal example we only have the top level section and this for loop iterates over those.

> {{ page.date | date(format="%-d %b %Y") }}

In the `content/` section we mentioned that the metadata in the `+++` block of the markdown files is available to templates. Here's an example of that. We're getting the `date` value of the page and formatting it for display.

> {{ page.title | safe }}

Another reference to page metadata. The safe filter tells Zola not to escape HTML in the content, allowing it to be rendered as-is.

Ok, now time for the article template. In Zola, this is the `page.html` file.

`templates/page.html`

```xml,name=templates/page.html
{% extends "index.html" %}

{% block title %}{{ config.title }} - {{ page.title }}{% endblock %}

{% block content %}
<div>
  <h1>{{ page.title }}</h1>
  <span>{{ page.date | date(format="%-d %b %Y") }}</span>
  {{ page.content | safe }}
</div>
{% endblock content %}
```

In this file you can see some of the templating features I've been talking about.

> {% extends "index.html" %}

This tells the renderer to take `templates/index.html` and replace the blocks there with those in this file.

> {% block title %}{{ config.title }} - {{ page.title }}{% endblock %}

And this is one such block substitution. What we're doing here is replacing the `title` block from `templates/index.html` with this, which includes the page title as well.

### themes/

The final folder to talk about is `themes`.
I won't be using it in this project, but what it lets you do is import another Zola sites templates, styles and resources. This is a very elegant way to adopt a theme of another site.
Any Zola site can be used as a theme, there's nothing special needed to make a theme a theme other than a `theme.toml` file, which just adds some metadata and usage information.

Anyway, themes are a topic for another article, let's get on with building the site.

At this point you should have the following files:

```
myblog/
├── config.toml
├── content
│   └── my-first-article.md
├── sass
│   ├── style.scss
│   └── _variables.scss
├── static
│   └── favicon.png
├── templates
│   ├── index.html
│   └── page.html
└── themes
```

## Building the Site

As with everything else with Zola, building the site is a simple thing:

Sit back and make a cup of coff.. nevermind, it's done. 🦀

```bash
$ zola build
Building site...
Checking all internal links with anchors.
> Successfully checked 0 internal link(s) with anchors.
-> Creating 1 pages (0 orphan) and 0 sections
Done in 8ms.
```

This will produce all your compiled site files in the `public/` directory, ready to be served by your favourite hosting provider.

This very blog is written using Zola (at the time of writing), you can check out the source code on [GitHub](https://github.com/d0x2f/d0x2f.github.io/tree/main/blog) for some more usage examples.
