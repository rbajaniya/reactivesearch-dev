/* eslint max-lines: 0 */
import React, { Component } from "react";
import classNames from "classnames";
import {
  InitialLoader,
  TYPES,
  AppbaseChannelManager as manager,
  AppbaseSensorHelper as helper
} from "@appbaseio/reactivemaps";

const _ = require("lodash");

export default class TagCloud extends Component {
  constructor(props) {
    super(props);
    this.state = {
      items: [],
      storedItems: [],
      rawData: {
        hits: {
          hits: []
        }
      },
      queryStart: false
    };
    this.sortObj = {
      aggSort: "asc"
    };
    this.highestCount = 0;
    this.previousSelectedSensor = {};
    this.channelId = null;
    this.channelListener = null;
    this.urlParams = helper.URLParams.get(this.props.componentId, this.props.multiSelect);
    this.type = this.props.multiSelect ? "terms" : "term";
    this.customQuery = this.customQuery.bind(this);
    this.defaultCustomQuery = this.defaultCustomQuery.bind(this);
  }

  // Get the items from Appbase when component is mounted
  componentDidMount() {
    this.size = this.props.size;
    this.setQueryInfo();
    this.createChannel();
    setTimeout(this.checkDefault.bind(this, this.props), 300);
    this.listenFilter();
  }

  componentWillReceiveProps(nextProps) {
    this.checkDefault(nextProps);
  }

  componentWillUnmount() {
    this.removeChannel();
  }

  listenFilter() {
    this.filterListener = helper.sensorEmitter.addListener("clearFilter", (data) => {
      if (data === this.props.componentId) {
        this.changeValue(null);
      }
    });
  }

  checkDefault(props) {
    if (this.state.items.length) {
      const defaultValue = this.urlParams !== null ? this.urlParams : props.defaultSelected;
      this.changeValue(defaultValue);
    }
  }

  changeValue(defaultValue) {
    if (this.props.multiSelect && !_.isEqual(this.defaultSelected, defaultValue)) {
      this.defaultSelected = defaultValue;
      const items = this.state.items.map((item) => {
        item.status = ((this.defaultSelected && this.defaultSelected.indexOf(item.key) > -1) || (this.selectedValue && this.selectedValue.indexOf(item.key) > -1));
        item.status = this.defaultSelected === null ? false : item.status;
        return item;
      });

      this.selectedValue = this.defaultSelected === null ? null : items.filter(item => item.status).map(item => item.key);

      this.setState({ items });

      if (this.props.onValueChange) {
        this.props.onValueChange(obj.value);
      }

      const obj = {
        key: this.props.componentId,
        value: this.selectedValue
      };
      helper.URLParams.update(this.props.componentId, obj.value, this.props.URLParams);
      helper.selectedSensor.set(obj, true);
    } else if (!this.props.multiSelect && this.defaultSelected !== defaultValue) {
      this.defaultSelected = defaultValue;
      const items = this.state.items.map((item) => {
        if (this.defaultSelected && this.defaultSelected === item.key) {
          item.status = !item.status;
        } else {
          item.status = false;
        }
        return item;
      });

      this.selectedValue = this.selectedValue === this.defaultSelected ? "" : this.defaultSelected;

      this.setState({ items });

      if (this.props.onValueChange) {
        this.props.onValueChange(obj.value);
      }

      const obj = {
        key: this.props.componentId,
        value: this.selectedValue
      };
      helper.URLParams.update(this.props.componentId, obj.value, this.props.URLParams);
      helper.selectedSensor.set(obj, true);
    }
  }

  customQuery(value) {
    const defaultQuery = this.props.customQuery ? this.props.customQuery : this.defaultCustomQuery;
    return defaultQuery(value);
  }

  defaultCustomQuery(value) {
    let query = null;
    if (value) {
      query = {
        [this.type]: {
          [this.props.appbaseField]: value
        }
      };
    }
    return query;
  }

  removeChannel() {
    if (this.channelId) {
      manager.stopStream(this.channelId);
    }
    if (this.channelListener) {
      this.channelListener.remove();
    }
    if (this.loadListener) {
      this.loadListener.remove();
    }
    if (this.filterListener) {
      this.filterListener.remove();
    }
  }

  setQueryInfo() {
    const obj = {
      key: this.props.componentId,
      value: {
        queryType: this.type,
        inputData: this.props.appbaseField,
        customQuery: this.customQuery,
        reactiveId: this.context.reactiveId,
        allowFilter: this.props.allowFilter,
        component: "TagCloud"
      }
    };
    helper.selectedSensor.setSensorInfo(obj);
  }

  includeAggQuery() {
    const obj = {
      key: `${this.props.componentId}-sort`,
      value: this.sortObj
    };
    helper.selectedSensor.setSortInfo(obj);
  }

  createChannel() {
    // Set the react - add self aggs query as well with react
    let react = this.props.react ? this.props.react : {};
    react.aggs = {
      key: this.props.appbaseField,
      sort: "asc",
      size: this.props.size,
      sortRef: `${this.props.componentId}-sort`
    };
    const reactAnd = [`${this.props.componentId}-sort`, "tagCloudChanges"];
    react = helper.setupReact(react, reactAnd);
    this.includeAggQuery();
    // create a channel and listen the changes
    const channelObj = manager.create(this.context.appbaseRef, this.context.type, react);
    this.channelId = channelObj.channelId;
    this.channelListener = channelObj.emitter.addListener(this.channelId, (res) => {
      if (res.error) {
        this.setState({
          queryStart: false
        });
      }
      if (res.appliedQuery) {
        const data = res.data;
        let rawData;
        if (res.mode === "streaming") {
          rawData = this.state.rawData;
          rawData.hits.hits.push(res.data);
        } else if (res.mode === "historic") {
          rawData = data;
        }
        this.setState({
          queryStart: false,
          rawData
        });
        this.setData(rawData);
      }
    });
    this.listenLoadingChannel(channelObj);
  }

  listenLoadingChannel(channelObj) {
    this.loadListener = channelObj.emitter.addListener(`${channelObj.channelId}-query`, (res) => {
      if (res.appliedQuery) {
        this.setState({
          queryStart: res.queryState
        });
      }
    });
  }

  setData(data) {
    if (data.aggregations && data.aggregations[this.props.appbaseField] && data.aggregations[this.props.appbaseField].buckets) {
      this.addItemsToList(data.aggregations[this.props.appbaseField].buckets);
    }
  }

  addItemsToList(newItems) {
    newItems = newItems.map((item) => {
      this.highestCount = item.doc_count > this.highestCount ? item.doc_count : this.highestCount;
      item.key = item.key.toString();
      if (this.props.multiSelect) {
        item.status = !!((this.selectedValue && this.selectedValue.indexOf(item.key) > -1));
      } else {
        item.status = this.selectedValue === item.key;
      }
      return item;
    });
    this.setState({
      items: newItems,
      storedItems: newItems
    }, () => {
      this.checkDefault(this.props);
      // if (this.props.multiSelect && this.defaultSelected) {
      // 	this.defaultSelected.forEach((item) => {
      // 		this.setValue(item);
      // 	});
      // } else if (!this.props.multiSelect && this.defaultSelected) {
      // 	this.setValue(this.defaultSelected);
      // }
    });
  }

  setValue(value) {
    let items;
    if (this.props.multiSelect) {
      items = this.state.items.map((item) => {
        if (value && value === item.key) {
          item.status = !item.status;
        }
        return item;
      });

      this.selectedValue = items.filter(item => item.status).map(item => item.key);
    } else {
      items = this.state.items.map((item) => {
        if (value && value === item.key) {
          item.status = !item.status;
        } else {
          item.status = false;
        }
        return item;
      });

      this.selectedValue = this.selectedValue === value ? "" : value;
    }

    this.setState({ items });

    if (this.props.onValueChange) {
      this.props.onValueChange(obj.value);
    }

    const obj = {
      key: this.props.componentId,
      value: this.selectedValue
    };
    this.defaultSelected = this.selectedValue;
    helper.URLParams.update(this.props.componentId, obj.value, this.props.URLParams);
    helper.selectedSensor.set(obj, true);
  }

  renderTags() {
      const min = 0.8,
        max = 3;

      return this.state.items.map((item) => {
            const size = ((item.doc_count / this.highestCount) * (max - min)) + min;
            const cx = item.status ? "active" : "";

            return ( <
              a className = { `rbc-list-item ${cx}` }
              onClick = {
                () => this.setValue(item.key) }
              key = { item.key }
              style = {
                { fontSize: `${size}em` } } >
              { item.key } {
                this.props.showCount ? ( < span className = "rbc-count" > { item.doc_count } < /span>) : ""} <
                  /a>
                );
              });
          }

          render() {
            let title = null;

            if (this.state.items.length === 0) {
              return null;
            }

            if (this.props.title) {
              title = ( < h4 className = "rbc-title col s12 col-xs-12" > { this.props.title } < /h4>);
              }

              const cx = classNames({
                "rbc-title-active": this.props.title,
                "rbc-title-inactive": !this.props.title,
                "rbc-count-active": this.props.showCount,
                "rbc-count-inactive": !this.props.showCount,
                "rbc-multiSelect-active": this.props.multiSelect,
                "rbc-multiSelect-inactive": !this.props.multiSelect,
                "rbc-initialloader-active": this.props.initialLoader,
                "rbc-initialloader-inactive": !this.props.initialLoader
              });

              return ( <
                div className = { `rbc rbc-tagcloud col s12 col-xs-12 card thumbnail ${cx}` }
                style = { this.props.componentStyle } > { title } <
                div className = "rbc-list-container" > { this.renderTags() } <
                /div> {
                  this.props.initialLoader && this.state.queryStart ? ( < InitialLoader defaultText = { this.props.initialLoader }
                    />) : null} <
                    /div>
                  );
                }
              }

              TagCloud.propTypes = {
                appbaseField: React.PropTypes.string.isRequired,
                componentId: React.PropTypes.string.isRequired,
                title: React.PropTypes.oneOfType([
                  React.PropTypes.string,
                  React.PropTypes.element
                ]),
                size: React.PropTypes.number,
                showCount: React.PropTypes.bool,
                multiSelect: React.PropTypes.bool,
                customQuery: React.PropTypes.func,
                initialLoader: React.PropTypes.oneOfType([
                  React.PropTypes.string,
                  React.PropTypes.element
                ]),
                defaultSelected: React.PropTypes.oneOfType([
                  React.PropTypes.string,
                  React.PropTypes.number,
                  React.PropTypes.array
                ]),
                react: React.PropTypes.object,
                onValueChange: React.PropTypes.func,
                componentStyle: React.PropTypes.object,
                URLParams: React.PropTypes.bool,
                allowFilter: React.PropTypes.bool
              };

              TagCloud.defaultProps = {
                showCount: true,
                multiSelect: false,
                size: 100,
                title: null,
                componentStyle: {},
                URLParams: false,
                allowFilter: true
              };

              TagCloud.contextTypes = {
                appbaseRef: React.PropTypes.any.isRequired,
                type: React.PropTypes.any.isRequired,
                reactiveId: React.PropTypes.number
              };

              TagCloud.types = {
                componentId: TYPES.STRING,
                appbaseField: TYPES.STRING,
                appbaseFieldType: TYPES.KEYWORD,
                title: TYPES.STRING,
                size: TYPES.NUMBER,
                showCount: TYPES.BOOLEAN,
                multiSelect: TYPES.BOOLEAN,
                customQuery: TYPES.FUNCTION,
                initialLoader: TYPES.STRING,
                defaultSelected: TYPES.STRING,
                react: TYPES.OBJECT,
                URLParams: TYPES.BOOLEAN,
                allowFilter: TYPES.BOOLEAN
              };
