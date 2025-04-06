+++
title = "Using Zola to Build a Blog"
date = "2025-04-06"

tags = ["zola", "web", "markdown"]
+++

As an avid crustacean, when I look for something new to use, I google "\<thing I want\> rust". And so, when I needed a static site generator, I was introduced to [Zola](https://www.getzola.org/).

It was a bit confusing at first to understand how a project was meant to be organised. There are a lot of default folders and the quick start guide told you where to create what, but it wasn't clear (to me at least) why.

In this post, I'll aim to give an overview of how to build a simple blog site like this one using Zola.

To begin with, install Zola on your machine. I'm an arch linux user (btw), so I installed it with pacman:

```sh
$ pacman -S zola
```

You can find instructions for other platforms in the official Zola documentation [here](https://www.getzola.org/documentation/getting-started/installation/).

With Zola installed, we can now initialise a project using:

```sh
$ zola init myblog
```

This will start a wizard where you can select which features to enable for your site.

> \> What is the URL of your site? (https://example.com):

This will set the `base_url` configuration option in your generated `config.toml` file which can be referenced in your page (more on that later).

> \> Do you want to enable Sass compilation? [Y/n]:

If you want to use Sass for CSS, you can enable it. If you've never used it before and don't know what it is, I think it's best to enable it and learn what it does. It's basically CSS with variables, imports and functions.

> \> Do you want to enable syntax highlighting? [y/N]:

Of course you do.

> \> Do you want to build a search index of the content? [y/N]:

At this point I was thinking "why not?". What this does is set the `build_search_index` config option to true, which, when your site is compiled, will include a generated search index javascript file in the built website. You can use this search index in your templates to filter and find articles with a search box.

Note that all these questions simply set a config option. There's are no complicated dependency fetching, version compatibility issues, vulnerability reports and everything else you may have stressed about with dynamic front-end frameworks. Everything you choose to enable is provided by and built-in to Zola.

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

Let's break down what each folder is for.

\<WIP\>
