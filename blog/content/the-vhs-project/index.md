+++
title = "The VHS Project"
description = "My journey digitising old family home videos from VHS and Hi8 tapes."
date = "2025-11-20"

[taxonomies]
tags = [
  "VHS", "hardware", "vhsdecode", "software",
  "panasonic", "DMR-ES35VP", "circuit", "PCB Way"
]

[extra]
author = "Dylan McGannon"
x_handle = "@D0x2f"
+++

## The Goal

When my wife's family brought out the old family home videos, I wasn't
expecting a moving box stacked with VHS and Hi8 tapes literally rotting
away in the garden shed. They had been shot around 20 to 35 years ago
and were not in the best condition.

{{
  image(
    path="the-vhs-project/box-of-tapes.jpg",
    width=300,
    height=400,
    op="fit_height",
    alt="A moving box of old tapes"
  )
}}

{{
  image(
    path="the-vhs-project/mouldy-tape.jpg",
    width=300,
    height=400,
    op="fit_height",
    alt="A mouldy VHS tape"
  )
}}

I figured it would be easy enough to buy a cheap PC capture card and do
a little digitisation project. But as someone who scores highly on the
geek spectrum, I went a little deeper than strictly necessary...

For this article, I'll focus on capture of the VHS tapes. To capture
Hi8 I'll need to find a player, most likely a camcorder, which I don't
have just yet.

## Investigation

Looking into the options available, I entered the confusing,
complicated and strange world of tape digitisation. There are generally
two competing methods that are surprisingly tribal and combative, at
least a few specific individuals love to trash the opposing method as
if it was an invention of Satan himself. This sorry situation floods
the web with misinformation and heavily opinionated takes that makes it
difficult to understand the real trade-offs.

The two camps are:

- Gathering a bunch of hardware like a "time based corrector" (TBC) and
  a chain of such things like up-scalers, converters and a capture
  card. Connecting them together and recording the result.
- Opening a VCR, finding where I can tap the raw RF signal from the
  tape head, route it through an amplifier and an RF capture device
  straight to my PC, then using software to decode the raw signal into
  a video file.

Since my goal was mostly recreational, I just chose the method that
looked the most fun and I don't think there's any arguing which option
that is.

## The Plan

The raw RF capture method is documented on the [oyvindln/vhs-decode
GitHub wiki](https://github.com/oyvindln/vhs-decode/wiki), which
deserves immense praise for making quite a technical endeavour much
more accessible for those that only dabble in hardware matters like
myself.

After a thorough reading of the wiki, I understood that I broadly
needed to accomplish the following:

- Buy the right circuit boards
- Open my VCR, find the RF test points and solder wires to them
- Connect everything together and try to capture a signal
- Process the signal into a nicely encoded video

Before I did any of this though, I went ahead and did a first pass
capture using a cheap USB composite video capture dongle. That's simple
enough so I won't go over how to do that in this post. The only thing
you need to get right is the capture settings in terms of interlacing,
framerate, resolution and such.

## Buying the Right Circuit Boards

There are many choices to make here regarding which hardware to use.
I settled on the
[MISRC capture device](https://github.com/Stefan-Olt/MISRC), which is
open source hardware that includes much of what would otherwise be
separate and rather complicated to put together such as including the
appropriate amplifier and clocks as well as supporting both audio and
video channels.

So, the setup for using the MISRC requires a few pieces:

- The [MISRC board](https://github.com/Stefan-Olt/MISRC) itself.
- A [Sipeed Tang Nano 20k FPGA](https://wiki.sipeed.com/hardware/en/tang/tang-nano-20k/nano-20k.html).
- [An adaptor](https://ko-fi.com/s/617b72ab2c) to connect the Tang Nano
  to the MISRC board.
- An MS2130 HDMI-USBC adaptor.

### MISRC

{{
  image(
    path="the-vhs-project/misrc.jpg",
    width=800,
    height=800,
    op="fit",
    alt="The VCR DMR-ES35V"
    class="w100"
  )
}}

To get an MISRC, there are a couple of options. Depending on stock you
can order a prefabricated one from [this ko-fi shop](https://ko-fi.com/s/a3abe4007e).
Otherwise, you will need to order one fabricated and assembled to order
from [PCBWay](https://www.pcbway.com/project/shareproject/MISRC_Multi_Input_Simultaneous_Raw_RF_Capture_Rev_1_0_998c1a4f.html),
there's also [a guide](https://github.com/Stefan-Olt/MISRC/wiki/Fabrication)
from the developers on how to make an order.

### Sipeed Tang Nano 20K

{{
  image(
    path="the-vhs-project/sipeed-tang-nano-20k.jpg",
    width=800,
    height=800,
    op="fit",
    alt="The VCR DMR-ES35V"
    class="w100"
  )
}}

The Sipeed Tang Nano 20k FPGA board is widely available, you can simply
[order one from Amazon](https://amzn.eu/d/hR9tBkv). If available,
opting for a pre-soldered one makes sense, as it'll just slot right
into the adaptor without any special mounting needed.

### MISRC <=> Tang Nano Adaptor Board

<!-- #TODO: Image of the adaptor board -->

Acquiring the adaptor board is similar to the MISRC, either buy one
from [harrypm's ko-fi shop](https://ko-fi.com/s/617b72ab2c), or get one
made using PCBWay. Going the PCBWay route is a little more complicated
however as there's no shared project (at least not that I could find),
you need to submit the [design
files](https://github.com/Stefan-Olt/MISRC/tree/main/hardware-extra/fx3-tangnano20k-adapter)
for a custom job. Note that ordering from the ko-fi shop can take a
very long time, for me it took over 2 months and this was the last
piece to arrive.

### MS2130 HDMI-USBC Dongle

<!-- #TODO: Image of the MS2130 dongle -->

Finally, the MS2130 HDMI-USBC dongle is a simple purchase available in
many forms [on Amazon](https://amzn.eu/d/dzeXYY6). The `MS2130` name
refers to the specific IC chip which is used in many different capture
dongles of different brands. As far as I know it doesn't matter which
brand or form factor you get.

## Soldering Wires to my VCR

This part required some research. I have a Panasonic DMR-ES35VP, which
is a VHS/DVD combo player & recorder. In order to find the appropriate
test points I needed to tap, I had to scour it's [service
manual](https://www.manualslib.com/manual/791994/Panasonic-Dmr-Es35vp.html#product-DMR-ES35VP).
Based on advice from the [vhs-decode
wiki](https://github.com/oyvindln/vhs-decode/wiki/Hardware-Installation-Guide#test-point-names)
I scanned the pages for something with a label like `ENV`, `VENV` or
`VIDEO ENVELOPE`, as well as `AENV`, `AUDIO ENV`, `HIFI ENV` or `FM
MIX` for the audio.

{{
  image(
    path="the-vhs-project/DMR-ES35V.jpg",
    width=800,
    height=800,
    op="fit",
    alt="The VCR DMR-ES35V"
    class="w100"
  )
}}

It actually took a long time to find what I thought were the right test
points, but I eventually spotted them to be `VIDEO ENV/TW3001` for
video and `ENVE/TW4502` for Hi-Fi audio. The labeling varies between
brands, so make sure to read the service manual carefully to ensure you
use the right ones. I actually used the wrong test point for audio when
I first did the soldering, I went with the point labelled `FM
MIX/TW4501` on the audio circuit, but this isn't what we want, if you
read the manual closely you can see that that test point only carries a
signal during recording. In the case of this VCR, there is a separate
test point labelled `ENVE/TW4502` right next to `VIDEO ENVE/TW3001`,
which the right one to tap.

{{
  gallery(images=[
    "the-vhs-project/service-manual-audio-test-point-p65.png",
    "the-vhs-project/service-manual-audio-test-point-p81.png",
    "the-vhs-project/service-manual-video-test-point-p64.png",
    "the-vhs-project/service-manual-video-test-point-p78.png",
    "the-vhs-project/open-vcr.jpg"
  ])
}}

<!-- {{
  image(
    path="the-vhs-project/service-manual-audio-test-point-p65.png",
    width=300,
    height=400,
    op="fit_width",
    alt="Audio test point in service manual"
  )
}}

{{
  image(
    path="the-vhs-project/service-manual-audio-test-point-p81.png",
    width=300,
    height=400,
    op="fit_width",
    alt="Audio test point in service manual"
  )
}}

{{
  image(
    path="the-vhs-project/service-manual-video-test-point-p64.png",
    width=300,
    height=400,
    op="fit_width",
    alt="Video test point in service manual"
  )
}}

{{
  image(
    path="the-vhs-project/service-manual-video-test-point-p78.png",
    width=300,
    height=400,
    op="fit_width",
    alt="Video test point in service manual"
  )
}}

{{
  image(
    path="the-vhs-project/open-vcr.jpg",
    width=300,
    height=400,
    op="fit_width",
    alt="Opened VCR showing test point location"
  )
}} -->

Once the test points were identified, it was time to do the soldering.
Since the wires will be carrying very sensitive low power signals, it's
important to ensure they are shielded. For this I used coax cabling
with the outer sheath attached to ground. To find a ground pin, I used
a multimeter in continuity mode to probe various test points in
convenient places against the chassis. Turns out there's a very
convenient ground wire right next to the test points.

<!-- #TODO: Images of multimeter and ground point testing -->

<!-- #TODO: Images of test points before and after solder -->

I initially intended to make a hole in the VCR chassis and mount a BNC
connector, but the chassis is metal and I don't have the appropriate
tools, so I ended up just routing the wires our the side vents and
terminating with the BNC connector.

<!-- #TODO: Image of BNC connectors routed externally -->

With this, the VCR was done and ready to be closed. But while I'm
here... I may as well do some cleaning and lubing of the tape
mechanism. I added a drop of sewing machine oil into each of the gears
I could find and cleaned the cylinder head carefully with some
isopropyl alcohol (IPA) and a microfibre cloth. The advice I followed
was to slightly wet the cloth with IPA then steadily hold it against
the cylinder head while slowly using your finger to rotate the head
around a few revolutions (without touching the surface). The main idea
is not to swipe the cloth perpendicular to the grooves, which might
cause damage or snag and trap lint inside.

<!-- #TODO: Image holding the cloth against the cylinder head -->

## A Note About Hi-Fi Audio

I didn't know this going in and it cost me some time. Hi-Fi audio is a
specific type of high quality audio recorded separately from the usual
linear audio tracks. You can see how it's laid out on the tape in this
diagram:

{{
  image(
    path="the-vhs-project/tape-layout-diagram.jpg",
    width=800,
    height=800,
    op="fit",
    alt="Diagram showing physical data layout on VHS tape"
    class="w100"
  )
}}

Source: [Sam's VCR FAQ](https://www.repairfaq.org/sam/vcrfil.htm)

It was a later addition to the VHS format, so not all tapes will have
it. It's also common that home videos won't have this type of audio
signal present. What this means is that the Hi-Fi audio tap point
`ENVE/TW4502` only carries a signal for tapes that have it. For tapes
that don't, you'll need to record the linear audio and join it to the
video.

<!-- TODO: Show how I did it -->

## Capturing a Signal

With all the pieces assembled, I now tried to get it all working.
Connecting everything together is straight forward and the software is
very easy to use, although a little tricky to install.

To make a capture use the `misrc_capture` utility:

```sh
misrc_capture -p -f -l 8 -a video_rf.flac -b hifi_rf.flac -c aux.bin
```

What you want to see is a clean progress output without any notices
about dropped clipped samples. Samples are clipped when they are too
low or too high and it means that something is wrong with the capture.
It could be that the amplification is too high or too low, it could
also be that the zero adjust is set too far out of whack. At this point
we're just trying to confirm that there is a signal, we can look into
tuning it properly later. So if you continue getting clipped samples,
try changing the amplification up or down using the dip switches on the
MISRC board. You can also try tuning the zero adjust pot.

Captures are very large, expect hundreds of gigabytes per tape!

## Turning it into a Video

With the output from `misrc_capture`, you can decode each into video or
audio.

### Video Component

Take the `video_rf.flac` files and run it through `vhs-decode` like so:

```sh
vhs-decode --debug --ire0_adjust --recheck_phase \
  --frequency 40 --pal --threads 8 --tape_format vhs \
  video_rf.flac video_decoded.tbc
```

This produces a decoded file ready to be processed into a conventional
video file in an `mkv` container using the provided `tbc-video-export`
tool:

```sh
tbc-video-export video_decoded.tbc
```

### Audio Component

If your tape has Hi-Fi audio data, then you should of course prefer
that over the linear audio. If not, then you need to mux the linear
audio into the video.

## Tuning the Signal Capture

## Results
