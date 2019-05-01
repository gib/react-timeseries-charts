/**
 *  Copyright (c) 2016, The Regents of the University of California,
 *  through Lawrence Berkeley National Laboratory (subject to receipt
 *  of any required approvals from the U.S. Dept. of Energy).
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import _ from "underscore";
import React from "react";
import PropTypes from "prop-types";
import merge from "merge";
import { TimeEvent, TimeRangeEvent, IndexedEvent, Index, TimeRange } from "pondjs";
import { timeFormat } from "d3-time-format";

import Label from "./Label";
import ValueList from "./ValueList";

/**
 * Renders a marker at a specific event on the chart.
 *
 * To explain how EventMarkers work, it's useful to explain a little
 * terminology used here. A marker has several parts:
 *
 *  * the "marker" itself which appears at the (value, time) of the event.
 *    This is a dot which whose radius is defined by markerRadius, and
 *    whose style is set with markerStyle
 *  * the "markerLabel" which is a string that will be rendered next to
 *    the marker. The label can be aligned with markerAlign and also
 *    styled with markerLabelStyle
 *  * the "info box" which is a box containing values that hovers that the
 *    top of the chart. Optionally it can show the time above the box or in the
 *    box. The values themselves are supplied as an array of objects using
 *    the `info` prop. The info box can be styled with `infoStyle`,
 *    sized with `infoWidth` and `infoHeight`, and the time formatted
 *    with `infoTimeFormat`
 *  * the "stem" which is a connector between the marker and the
 *    info box to visually link the two
 *
 * Combining these attributes, Event markers fall into two flavors, either
 * you want to omit the infoBox and mark the event with a dot and optionally
 * a label, or you want to omit the label (and perhaps marker dot) and show
 * a flag style marker with the infoBox connected to the event with the stem.
 *
 * As with other IndexedEvents or TimeRangeEvents, the marker will appear at
 * the center of the timerange represented by that event. You can, however,
 * override either the x or y position by a number of pixels.
 */
export default class EventMarker extends React.Component {
    indexValue(index, format = "%m/%d/%y %X") {
        if (_.isFunction(format)) {
            return format(index);
        }
        if (_.isString(format)) {
            const fmt = timeFormat(format);
            return fmt(index.begin());
        }
        return index.toString();
    }

    timeRangeValue(timerange, format = "%m/%d/%y %X") {
        const d1 = timerange.begin();
        const d2 = timerange.end();

        let beginText;
        let endText;

        if (_.isFunction(format)) {
            beginText = format(d1);
            endText = format(d2);
        } else {
            const fmt = timeFormat(format);
            beginText = fmt(d1);
            endText = fmt(d2);
        }
        return `${beginText} to ${endText}`;
    }

    timeValue(time, format = "%m/%d/%y %X") {
        if (_.isFunction(format)) {
            return format(time);
        }
        const fmt = timeFormat(format);
        return fmt(time);
    }

    timeForType(event) {
        if (event instanceof TimeEvent) {
            return this.timeValue(this.props.infoTimeFormat);
        }
        if (event instanceof IndexedEvent) {
            return this.indexValue(event.index(), this.props.infoTimeFormat);
        }
        if (event instanceof TimeRangeEvent) {
            return this.timeValue(event.timerange(), this.props.infoTimeFormat);
        }
        // pass through
        return "";
    }

    renderTime(event) {
        const textStyle = {
            fontSize: 11,
            textAnchor: "left",
            fill: "#bdbdbd",
            pointerEvents: "none"
        };
        let text = this.timeForType(event);

        if (!text) {
            return <g />;
        }

        return (
            <text x={0} y={0} dy="1.2em" style={textStyle}>
                {text}
            </text>
        );
    }

    renderInfoBox(event, info, props) {
        let time = "";
        if (info) {
            if (this.props.infoTimeInBox) {
                time = this.timeForType(event);
            }
            if (_.isString(this.props.info)) {
                return <Label {...props} label={info} time={time} />;
            } else {
                return <ValueList {...props} values={info} time={time} />;
            }
        }
        return <g />;
    }

    renderMarker(event, column, info) {
        let t;
        if (event instanceof TimeEvent) {
            t = event.timestamp();
        } else {
            t = new Date(
                event.begin().getTime() + (event.end().getTime() - event.begin().getTime()) / 2
            );
        }

        let value;
        if (this.props.yValueFunc) {
            value = this.props.yValueFunc(event, column);
        } else {
            value = event.get(column);
        }

        let timeStamp;
        if (!this.props.infoTimeInBox) {
            timeStamp = this.renderTime(event);
        }

        // Allow overrides on the x and y position. This is useful for the barchart
        // tracker because bars maybe be offset from their actual event position in
        // order to display them side by side.
        const posx = this.props.timeScale(t) + this.props.offsetX;
        const posy = this.props.yScale(value) - this.props.offsetY;

        const infoBoxProps = {
            align: "left",
            style: this.props.infoStyle,
            width: this.props.infoWidth,
            height: this.props.infoHeight
        };

        const w = this.props.infoWidth;
        const lineBottom = posy - 10;

        let verticalStem;
        let horizontalStem;
        let dot;
        let transform;
        let label;

        //
        // Marker on right of event
        //

        if (this.props.type === "point") {
            let textDefaultStyle = {
                fontSize: 11,
                pointerEvents: "none",
                paintOrder: "stroke",
                fill: "#b0b0b0",
                strokeWidth: 2,
                strokeLinecap: "butt",
                strokeLinejoin: "miter",
                fontWeight: 800
            };

            let dx = 0;
            let dy = 0;
            switch (this.props.markerLabelAlign) {
                case "left":
                    dx = 5;
                    textDefaultStyle.textAnchor = "start";
                    textDefaultStyle.alignmentBaseline = "central";
                    break;
                case "right":
                    dx = -5;
                    textDefaultStyle.textAnchor = "end";
                    textDefaultStyle.alignmentBaseline = "central";
                    break;
                case "top":
                    dy = -5;
                    textDefaultStyle.textAnchor = "middle";
                    textDefaultStyle.alignmentBaseline = "bottom";
                    break;
                case "bottom":
                    dy = 5;
                    textDefaultStyle.textAnchor = "middle";
                    textDefaultStyle.alignmentBaseline = "hanging";
                    break;
                default:
                //pass
            }

            const tstyle = merge(true, textDefaultStyle, this.props.markerLabelStyle);

            dot = (
                <circle
                    cx={posx}
                    cy={posy}
                    r={this.props.markerRadius}
                    pointerEvents="none"
                    style={this.props.markerStyle}
                />
            );
            label = (
                <text x={posx} y={posy} dx={dx} dy={dy} style={tstyle}>
                    {this.props.markerLabel}
                </text>
            );

            return (
                <g>
                    {dot}
                    {label}
                </g>
            );
        } else {
            if (posx + 10 + w < (this.props.width * 3) / 4) {
                if (info) {
                    verticalStem = (
                        <line
                            pointerEvents="none"
                            style={this.props.stemStyle}
                            x1={-10}
                            y1={lineBottom}
                            x2={-10}
                            y2={20}
                        />
                    );
                    horizontalStem = (
                        <line
                            pointerEvents="none"
                            style={this.props.stemStyle}
                            x1={-10}
                            y1={20}
                            x2={-2}
                            y2={20}
                        />
                    );
                }
                dot = (
                    <circle
                        cx={-10}
                        cy={lineBottom}
                        r={this.props.markerRadius}
                        pointerEvents="none"
                        style={this.props.markerStyle}
                    />
                );
                transform = `translate(${posx + 10},${10})`;
            } else {
                if (info) {
                    verticalStem = (
                        <line
                            pointerEvents="none"
                            style={this.props.stemStyle}
                            x1={w + 10}
                            y1={lineBottom}
                            x2={w + 10}
                            y2={20}
                        />
                    );
                    horizontalStem = (
                        <line
                            pointerEvents="none"
                            style={this.props.stemStyle}
                            x1={w + 10}
                            y1={20}
                            x2={w + 2}
                            y2={20}
                        />
                    );
                }
                dot = (
                    <circle
                        cx={w + 10}
                        cy={lineBottom}
                        r={this.props.markerRadius}
                        pointerEvents="none"
                        style={this.props.markerStyle}
                    />
                );
                transform = `translate(${posx - w - 10},${10})`;
            }

            return (
                <g transform={transform}>
                    {verticalStem}
                    {horizontalStem}
                    {dot}
                    {timeStamp}
                    <g transform={`translate(0,${20})`}>
                        {this.renderInfoBox(event, info, infoBoxProps)}
                    </g>
                </g>
            );
        }
    }

    render() {
        const { event, column, info } = this.props;
        if (!event) {
            return <g />;
        }
        return <g>{this.renderMarker(event, column, info)}</g>;
    }
}

EventMarker.propTypes = {
    type: PropTypes.oneOf(["point", "flag"]),

    /**
     * What [Pond Event](https://esnet-pondjs.appspot.com/#/event) to mark
     */
    event: PropTypes.oneOfType([
        PropTypes.instanceOf(TimeEvent),
        PropTypes.instanceOf(IndexedEvent),
        PropTypes.instanceOf(TimeRangeEvent)
    ]),

    /**
     * Which column in the Event to use
     *
     * NOTE : Columns can't have periods because periods
     * represent a path to deep data in the underlying events
     * (i.e. reference into nested data structures)
     */
    column: PropTypes.string,

    /**
     * The values to show in the info box. This is either an array of
     * objects, with each object specifying the label and value
     * to be shown in the info box, or a simple string label. If this
     * prop is not supplied, no infoBox will be displayed.
     */
    info: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.arrayOf(
            PropTypes.shape({
                label: PropTypes.string, // eslint-disable-line
                value: PropTypes.string // eslint-disable-line
            })
        )
    ]),

    /**
     * The style of the info box itself. Typically you'd want to
     * specify a fill color, and stroke color/width here.
     */
    infoStyle: PropTypes.object,

    /**
     * The width of the info box
     */
    infoWidth: PropTypes.number,

    /**
     * The height of the info box
     */
    infoHeight: PropTypes.number,

    /**
     * Alter the format of the timestamp shown on the info box.
     * This may be either a function or a string. If you provide a function
     * that will be passed an Index and should return a string. For example:
     * ```
     *     index => moment(index.begin()).format("Do MMM 'YY")
     * ```
     * Alternatively you can pass in a d3 format string. That will be applied
     * to the begin time of the Index range.
     */
    infoTimeFormat: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),

    /**
     * Place the timestamp inside the infobox default is above the box
     * when you may not need a box, but still want the timestamp. This Will
     * also support only a timestamp in the infobox.
     */
    infoTimeInBox: PropTypes.bool,

    /**
     * Show a label to the left or right of the marker
     */
    markerLabelAlign: PropTypes.oneOf(["left", "right", "top", "bottom"]),

    /**
     * The radius of the dot at the end of the marker
     */
    markerRadius: PropTypes.number,

    /**
     * The style of the event marker dot
     */
    markerStyle: PropTypes.object,

    /**
     * The y value is calculated by the column and event, but if
     * this prop is provided this will be used instead.
     */
    yValueFunc: PropTypes.func,

    /**
     * Offset the marker position in the x direction.
     */
    offsetX: PropTypes.number,

    /**
     * Offset the marker position in the y direction
     */
    offsetY: PropTypes.number,

    /**
     * [Internal] The timeScale supplied by the surrounding ChartContainer
     */
    timeScale: PropTypes.func,

    /**
     * [Internal] The yScale supplied by the associated YAxis
     */
    yScale: PropTypes.func,

    /**
     * [Internal] The width supplied by the surrounding ChartContainer
     */
    width: PropTypes.number
};

EventMarker.defaultProps = {
    type: "flag",
    column: "value",
    infoWidth: 90,
    infoHeight: 25,
    infoStyle: {
        fill: "white",
        opacity: 0.9,
        stroke: "#999",
        pointerEvents: "none"
    },
    infoTimeInBox: false,
    stemStyle: {
        stroke: "#999",
        cursor: "crosshair",
        pointerEvents: "none"
    },
    markerStyle: {
        fill: "#999"
    },
    markerRadius: 2,
    markerLabelAlign: "left",
    markerLabelStyle: {
        fill: "#999"
    },
    offsetX: 0,
    offsetY: 0
};
