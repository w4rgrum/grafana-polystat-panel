///<reference path="../node_modules/grafana-sdk-mocks/app/headers/common.d.ts" />

import _ from "lodash";
import kbn from "app/core/utils/kbn";

export class MetricOverride {
    metricName: string;
    thresholds: Array<any>;
    colors: Array<string>;
    unitFormat: string;
    decimals: string;
    scaledDecimals: number;
    enabled: boolean;
    operatorName: string; // avg/min/max etc
    prefix: string;
    suffix: string;
    clickThrough: string;
    sanitizeURLEnabled: boolean;
    sanitizedURL: string;
}

export class MetricOverridesManager {
    metricOverrides : Array < MetricOverride >;
    $scope: any;
    $sanitize: any;
    templateSrv: any;
    suggestMetricNames: any;

    constructor($scope, templateSrv, $sanitize, savedOverrides) {
        this.$scope = $scope;
        this.$sanitize = $sanitize;
        this.templateSrv = templateSrv;
        // typeahead requires this form
        this.suggestMetricNames = () => {
            return _.map(this.$scope.ctrl.series, function (series) {
                return series.alias;
            });
        };
        this.metricOverrides = savedOverrides;
    }

    addMetricOverride() {
        let override = new MetricOverride();
        override.metricName = "";
        override.thresholds = [];
        override.colors = ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"];
        override.decimals = "";
        override.enabled = true;
        override.unitFormat = "";
        override.clickThrough = "";
        override.operatorName = "avg";
        override.scaledDecimals = null;
        override.prefix = "";
        override.suffix = "";
        override.sanitizeURLEnabled = true;
        this.metricOverrides.push(override);
    }

    removeMetricOverride(override) {
        this.metricOverrides = _.without(this.metricOverrides, override);
        this.$scope.ctrl.refresh();
    }

    matchOverride(pattern) : number {
        for (let index = 0; index < this.metricOverrides.length; index++) {
            let anOverride = this.metricOverrides[index];
            var regex = kbn.stringToJsRegex(anOverride.metricName);
            var matches = pattern.match(regex);
            if (matches && matches.length > 0) {
                return index;
            }
        }
        return -1;
    }

    applyOverrides(data) {
        for (let index = 0; index < data.length; index++) {
            let matchIndex = this.matchOverride(data[index].name);
            if (matchIndex >= 0) {
                let anOverride = this.metricOverrides[matchIndex];
                let dataValue = this.getValueByStatName(anOverride, data[index]);
                // set value to what was returned
                data[index].value = dataValue;
                data[index].color = this.getColorForValue(matchIndex, data[index].value);
                data[index].thresholdLevel = this.getThresholdLevelForValue(matchIndex, data[index].value);
                // format it
                var formatFunc = kbn.valueFormats[anOverride.unitFormat];
                if (formatFunc) {
                    // put the value in quotes to escape "most" special characters
                    data[index].valueFormatted = formatFunc(data[index].value, anOverride.decimals, anOverride.scaledDecimals);
                    data[index].valueRounded = kbn.roundValue(data[index].value, anOverride.decimals);
                }
                // copy the threshold data into the object
                data[index].thresholds = anOverride.thresholds;
                data[index].prefix = anOverride.prefix;
                data[index].suffix = anOverride.suffix;
                // set the url, replace template vars
                if ((anOverride.clickThrough) && (anOverride.clickThrough.length > 0)) {
                    data[index].clickThrough = this.templateSrv.replaceWithText(anOverride.clickThrough);
                    if (anOverride.sanitizeURLEnabled) {
                        data[index].sanitizedURL = this.$sanitize(data[index].clickThrough);
                    }
                }
            }
        }
    }

    getValueByStatName(settings, data) {
        let value = data.stats.avg;
        switch (settings.operatorName) {
            case "avg":
                value = data.stats.avg;
                break;
            case "count":
                value = data.stats.count;
                break;
            case "current":
                value = data.stats.current;
                break;
            case "delta":
                value = data.stats.delta;
                break;
            case "diff":
                value = data.stats.diff;
                break;
            case "first":
                value = data.stats.first;
                break;
            case "logmin":
                value = data.stats.logmin;
                break;
            case "max":
                value = data.stats.max;
                break;
            case "min":
                value = data.stats.min;
                break;
            case "name":
                value = data.metricName;
                break;
            case "time_step":
                value = data.stats.timeStep;
                break;
            case "last_time":
                value = data.timestamp;
                break;
            case "total":
                value = data.stats.total;
                break;
            default:
                value = data.stats.avg;
                break;
        }
        return value;
    }

    getColorForValue(index, value: number): string {
      let lastColor = "#808080"; // "grey";
      if (value === null) {
        return lastColor;
      }
      let anOverride = this.metricOverrides[index];
      for (let i = anOverride.thresholds.length - 1; i >= 0; i--) {
        let aThreshold = anOverride.thresholds[i];
          if (value >= aThreshold.value) {
            return aThreshold.color;
          }
        lastColor = aThreshold.color;
      }
      return lastColor;
  }

    // user may define the threshold with just one value
    getThresholdLevelForValue(index, value: number): number {
      if (value === null) {
        return 3; // No Data
      }
      let anOverride = this.metricOverrides[index];
      let lastState = 0;
      for (let i = anOverride.thresholds.length - 1; i >= 0; i--) {
        let aThreshold = anOverride.thresholds[i];
        if (value >= aThreshold.value) {
          return aThreshold.state;
        }
        lastState = aThreshold.state;
      }
      return lastState;
    }

    addThreshold(override) {
      override.thresholds.push( {
        value: 0,
        state: 0,
        color: "#299c46",
      });
      this.sortThresholds(override);
    }

    // store user selection of color to be used for all items with the corresponding state
    setThresholdColor(threshold) {
      switch (threshold.state) {
        case 0:
          threshold.color = "#299c46";
          break;
        case 1:
          threshold.color = "rgba(237, 129, 40, 0.89)";
          break;
        case 2:
          threshold.color = "#d44a3a";
          break;
      }
    }

    validateThresholdColor(threshold) {
      switch (threshold.state) {
        case 0:
          threshold.color = "#299c46";
          break;
        case 1:
          threshold.color = "rgba(237, 129, 40, 0.89)";
          break;
        case 2:
          threshold.color = "#d44a3a";
          break;
      }
    }

    sortThresholds(override) {
      override.thresholds = _.orderBy(override.thresholds, ["value"], ["asc"]);
      this.$scope.ctrl.refresh();
    }

    removeThreshold(override, threshold) {
      override.thresholds = _.without(override.thresholds, threshold);
      this.sortThresholds(override);
    }

    invertColorOrder(override) {
      override.colors.reverse();
      this.$scope.ctrl.refresh();
    }

    setUnitFormat(override, subItem) {
        override.unitFormat = subItem.value;
    }

    moveMetricOverrideUp(override) {
        for (let index = 0; index < this.metricOverrides.length; index++) {
            let anOverride = this.metricOverrides[index];
            if (override === anOverride) {
                if (index > 0) {
                    this.arraymove(this.metricOverrides, index, index - 1);
                    break;
                }
            }
        }
    }
    moveMetricOverrideDown(override) {
        for (let index = 0; index < this.metricOverrides.length; index++) {
            let anOverride = this.metricOverrides[index];
            if (override === anOverride) {
                if (index < this.metricOverrides.length) {
                    this.arraymove(this.metricOverrides, index, index + 1);
                    break;
                }
            }
        }
    }

    arraymove(arr, fromIndex, toIndex) {
        var element = arr[fromIndex];
        arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, element);
    }
}
