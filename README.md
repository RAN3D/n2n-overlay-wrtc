# n2n-overlay-wrtc

This project aims to ease the creation of overlay networks on top of
WebRTC. Additional WebRTC-specific constraints make such projects more difficult
than they should be. For instance, establishing a connection requires a
round-trip of "offers". Such messages usually transit a dedicated signaling
server. The peers of this project still require a signaling server for their
entrance in the network. Afterwards, peers become signaling servers too, i.e.,
they mediate connections between their direct neighbors.

This module divides the entering arcs (inview) from the outgoing arcs (outview).

The way connections are handled are left to the discretion of overlay protocols
built on top of this module. A peer with two neighbors can ask to one of them to
connect to the other. Several overlay network protocols use neighbor-to-neighbor
interactions to converge to a topology exposing the desired properties.

## Installation

Using npm: ```$ npm install n2n-overlay-wrtc```

## API

The API is avalaible [here](https://ran3d.github.io/n2n-overlay-wrtc/)

## Example

A live example is available
[here](https://ran3d.github.io/n2n-overlay-wrtc/example/browser.html).

The module [spray-wrtc](https://github.com/ran3d/spray-wrtc) extends
n2n-overlay-wrtc to implement a random peer-sampling protocol.

