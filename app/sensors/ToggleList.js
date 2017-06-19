import React, { Component } from "react";
import classNames from "classnames";
import {
	TYPES,
	AppbaseSensorHelper as helper
} from "@appbaseio/reactivemaps";

const _ = require("lodash");

export default class ToggleList extends Component {
	constructor(props) {
		super(props);
		this.state = {
			selected: []
		};
		this.type = "term";
		this.urlParams = helper.URLParams.get(this.props.componentId, true);
		this.defaultSelected = null;
		this.handleChange = this.handleChange.bind(this);
		this.customQuery = this.customQuery.bind(this);
	}

	// Set query information
	componentDidMount() {
		this.setQueryInfo();
		// this.initialize(this.props);
		setTimeout(this.initialize.bind(this, this.props), 300);
		this.listenFilter();
	}

	componentWillReceiveProps(nextProps) {
		this.initialize(nextProps);
	}

	// stop streaming request and remove listener when component will unmount
	componentWillUnmount() {
		if(this.filterListener) {
			this.filterListener.remove();
		}
	}

	listenFilter() {
		this.filterListener = helper.sensorEmitter.addListener("clearFilter", (data) => {
			if(data === this.props.componentId) {
				this.changeValue(null);
			}
		});
	}

	initialize(props) {
		const defaultValue = this.urlParams !== null ? this.urlParams : props.defaultSelected;
		this.changeValue(defaultValue);
	}

	changeValue(defaultValue) {
		if (!_.isEqual(this.defaultSelected, defaultValue)) {
			this.defaultSelected = defaultValue;
			if (!this.props.multiSelect) {
				const records = this.defaultSelected === null ? null : this.props.data.filter(record => this.defaultSelected && this.defaultSelected.indexOf(record.label) > -1);
				this.setState({
					selected: records
				});
				if(this.props.onValueChange) {
					this.props.onValueChange(obj.value);
				}
				const obj = {
					key: this.props.componentId,
					value: records
				};
				helper.URLParams.update(this.props.componentId, this.setURLParam(obj.value), this.props.URLParams);
				helper.selectedSensor.set(obj, true);
			} else {
				let records = [];
				if(this.defaultSelected) {
					this.defaultSelected.forEach((item) => {
						records = records.concat(this.props.data.filter(record => item.indexOf(record.label) > -1));
					});
				} else if(this.defaultSelected === null) {
					records = null;
				}
				this.setState({
					selected: records
				});
				if(this.props.onValueChange) {
					this.props.onValueChange(obj.value);
				}
				const obj = {
					key: this.props.componentId,
					value: records
				};
				helper.URLParams.update(this.props.componentId, this.setURLParam(obj.value), this.props.URLParams);
				helper.selectedSensor.set(obj, true);
			}
		}
	}

	// set the query type and input data
	setQueryInfo() {
		const obj = {
			key: this.props.componentId,
			value: {
				queryType: this.type,
				inputData: this.props.appbaseField,
				customQuery: this.props.customQuery ? this.props.customQuery : this.customQuery,
				reactiveId: this.context.reactiveId,
				allowFilter: this.props.allowFilter,
				component: "ToggleList"
			}
		};
		helper.selectedSensor.setSensorInfo(obj);
	}

	// build query for this sensor only
	customQuery(record) {
		let query = null;

		function generateRangeQuery(appbaseField) {
			return record.map(singleRecord => ({
				term: {
					[appbaseField]: singleRecord.value
				}
			}));
		}

		if (record && record.length) {
			query = {
				bool: {
					should: generateRangeQuery(this.props.appbaseField),
					minimum_should_match: 1,
					boost: 1.0
				}
			};
			return query;
		}
		return query;
	}

	// handle the input change and pass the value inside sensor info
	handleChange(record) {
		const selected = this.state.selected ? this.state.selected : [];
		let newSelection = [];
		let selectedIndex = null;
		selected.forEach((selectedRecord, index) => {
			if (record.label === selectedRecord.label) {
				selectedIndex = index;
				selected.splice(index, 1);
			}
		});
		if (selectedIndex === null) {
			if (this.props.multiSelect) {
				selected.push(record);
				newSelection = selected;
			} else {
				newSelection.push(record);
			}
		} else {
			newSelection = selected;
		}
		this.setState({
			selected: newSelection
		});
		this.defaultSelected = newSelection;
		const obj = {
			key: this.props.componentId,
			value: newSelection
		};
		if(this.props.onValueChange) {
			this.props.onValueChange(obj.value);
		}
		// pass the selected sensor value with componentId as key,
		const isExecuteQuery = true;
		helper.URLParams.update(this.props.componentId, this.setURLParam(obj.value), this.props.URLParams);
		helper.selectedSensor.set(obj, isExecuteQuery);
	}

	setURLParam(value) {
		return value === null ? value : value.map(item => item.label);
	}

	renderList() {
		let list;
		const selectedText = this.state.selected ? this.state.selected.map(record => record.label) : "";
		if (this.props.data) {
			list = this.props.data.map(record => (
				<div key={record.label} className="rbc-list-item">
					<input
						type="checkbox"
						id={record.label}
						className="rbc-checkbox-item"
						checked={selectedText.indexOf(record.label) > -1}
						onChange={() => this.handleChange(record)}
					/>
					<label htmlFor={record.label} className="rbc-label">{record.label}</label>
				</div>
			));
		}
		return list;
	}

	// render
	render() {
		let title = null;
		if (this.props.title) {
			title = (<h4 className="rbc-title col s12 col-xs-12">{this.props.title}</h4>);
		}

		const cx = classNames({
			"rbc-title-active": this.props.title,
			"rbc-title-inactive": !this.props.title,
			"rbc-multiselect-active": this.props.multiSelect,
			"rbc-multiselect-inactive": !this.props.multiSelect
		});

		return (
			<div className={`rbc rbc-togglelist col s12 col-xs-12 card thumbnail ${cx}`} style={this.props.componentStyle}>
				<div className="row">
					{title}
					<div className="col s12 col-xs-12">
						{this.renderList()}
					</div>
				</div>
			</div>
		);
	}
}

ToggleList.propTypes = {
	componentId: React.PropTypes.string.isRequired,
	appbaseField: React.PropTypes.string.isRequired,
	title: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.element
	]),
	data: React.PropTypes.arrayOf(React.PropTypes.shape({
		label: React.PropTypes.string.isRequired,
		value: React.PropTypes.string.isRequired
	})),
	defaultSelected: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.arrayOf(React.PropTypes.string)
	]),
	multiSelect: React.PropTypes.bool,
	customQuery: React.PropTypes.func,
	onValueChange: React.PropTypes.func,
	componentStyle: React.PropTypes.object,
	URLParams: React.PropTypes.bool,
	allowFilter: React.PropTypes.bool
};

// Default props value
ToggleList.defaultProps = {
	multiSelect: true,
	componentStyle: {},
	URLParams: false,
	allowFilter: true
};

// context type
ToggleList.contextTypes = {
	appbaseRef: React.PropTypes.any.isRequired,
	type: React.PropTypes.any.isRequired,
	reactiveId: React.PropTypes.number
};

ToggleList.types = {
	componentId: TYPES.STRING,
	appbaseField: TYPES.STRING,
	appbaseFieldType: TYPES.KEYWORD,
	title: TYPES.STRING,
	data: TYPES.OBJECT,
	defaultSelected: TYPES.ARRAY,
	multiSelect: TYPES.BOOLEAN,
	customQuery: TYPES.FUNCTION,
	URLParams: TYPES.BOOLEAN,
	allowFilter: TYPES.BOOLEAN
};
