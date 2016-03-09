import React from 'react';
import _ from 'lodash';

export default class Form extends React.Component {

  static propTypes = {
    action: React.PropTypes.func,
    children: React.PropTypes.node.isRequired,
    className: React.PropTypes.string,
    name: React.PropTypes.string,
    model: React.PropTypes.object,
    onCatch: React.PropTypes.func,
    onSubmit: React.PropTypes.func,
    onSuccess: React.PropTypes.func,
    onValidationFail: React.PropTypes.func,
    validateForm: React.PropTypes.func,
    showValidationErrors: React.PropTypes.bool,
    waitIndicator: React.PropTypes.node,
  };

  static childContextTypes = {
    formModel: React.PropTypes.object,
    getFormModelValue: React.PropTypes.func,
    getFormStatus: React.PropTypes.func,
    gatherInputValues: React.PropTypes.func,
    registerFormControl: React.PropTypes.func,
    unregisterFormControl: React.PropTypes.func,
  };

  constructor (props, context) {
    super(props, context);
    this.state = {};
    this.getFormStatus = :: this.getFormStatus;
    this.getFormModelValue = ::this.getFormModelValue;
    this.onControlRegistration = ::this.onControlRegistration;
    this.onControlUnregistration = ::this.onControlUnregistration;
    this.registeredControls = [];
  }

  getChildContext () {
    return {
      formModel: this.props.model,
      getFormModelValue: this.getFormModelValue,
      getFormStatus: this.getFormStatus,
      gatherInputValues: this.gatherInputValues,
      registerFormControl: this.onControlRegistration,
      unregisterFormControl: this.onControlUnregistration,
    };
  }

  onSubmit (evt) {
    evt.preventDefault();
    if (this.state && this.state.isSubmitting) {
      return false;
    }

    const modelValue = this.gatherInputValues();
    const validationErrors = this.getValidationErrors(modelValue);
    if (validationErrors.length) {
      if (this.props.onValidationFail) {
        this.props.onValidationFail(validationErrors);
      }
      this.setState({
        validationErrors,
      });
      return undefined;
    }

    this.setState({
      validationErrors: undefined,
    }, () => {
      let shouldContinue = true;
      if (this.props.onSubmit) {
        shouldContinue = this.props.onSubmit(modelValue);
      }
      if (shouldContinue === false) {
        return undefined;
      }
      this.processFormAction(modelValue);
    });
  }

  onControlRegistration (input) {
    if (this.registeredControls.indexOf(input) === -1) {
      this.registeredControls.push(input);
    }
  }

  onControlUnregistration (input) {
    const index = this.registeredControls.indexOf(input);
    if (index !== -1) {
      this.registeredControls.splice(index, 1);
    }
  }

  getFormStatus () {
    return {
      isSubmitting: !!(this.state && this.state.isSubmitting),
    };
  }

  getFormModelValue (name) {
    return _.get(this.props.model || {}, name);
  }

  getFormValidationErrors (modelValue) {
    if (this.props.validateForm) {
      const errors = this.props.validateForm(modelValue, this);
      if (!errors) {
        return [];
      }
      return errors;
    } else {
      return [];
    }
  }

  getValidationErrors (modelValue) {
    return _.chain(this.registeredControls).map((control) => {
      if (!control.getValidationError) {
        return undefined;
      }
      const errorMessage = control.getValidationError();
      if (errorMessage) {
        /* eslint-disable no-console */
        console.warn('Validation error', control, errorMessage);
        return {
          errorMessage,
          control,
        };
      }
      return undefined;
    }).concat(this.getFormValidationErrors(modelValue)).compact().value();
  }

  render () {
    return (
      <form onSubmit={ ::this.onSubmit } className={ this.props.className } name={ this.props.name }>
        { this.renderValidationErrors() }
        { this.props.children }
        { this.renderWaitIndicator() }
      </form>
    );
  }

  renderValidationErrors () {
    if (this.props.showValidationErrors && this.state && this.state.validationErrors) {
      const messages = this.state.validationErrors.map((validation, i) => {
        return <li key={ i } className="form__validation-errors__message">{ validation.errorMessage }</li>;
      });
      return (
        <ul className="form__validation-errors">
          { messages }
        </ul>
      );
    }
  }

  renderWaitIndicator () {
    if (this.state && this.state.isSubmitting && this.props.waitIndicator) {
      return <div className="form__wait-indictator">{ this.props.waitIndicator }</div>;
    }
  }

  gatherInputValues () {
    return _.reduce(this.registeredControls, (model, control) => {
      if (control && _.isFunction(control.getValue)) {
        const value = control.getValue();
        if (value !== undefined) {
          _.set(model, control.props.name, value);
        }
      }
      return model;
    }, _.cloneDeep(this.props.model || {}));
  }

  processFormAction (modelValue) {
    if (this.props.action) {
      const response = this.props.action(modelValue);
      if (response && response.then && _.isFunction(response.then)) { // its a promise
        return this.processFormActionPromise(response);
      } else {
        if (response) { // true false response
          if (this.props.onSuccess) {
            this.props.onSuccess(modelValue);
          }
        } else {
          if (this.props.onCatch) {
            this.props.onCatch(modelValue);
          }
        }
      }
    }
  }

  processFormActionPromise (promise) {
    this.startSubmission();
    promise.then((model) => {
      this.endSubmission(() => {
        if (this.props.onSuccess) {
          this.props.onSuccess(model);
        }
      });
    }).catch((response) => {
      this.endSubmission(() => {
        if (this.props.onCatch) {
          this.props.onCatch(response);
        }
      });
    });
  }

  startSubmission (cb) {
    this.setState({
      isSubmitting: true,
    }, cb);
    this.registeredControls.forEach((input) => {
      if (input.setFormSubmitting) {
        input.setFormSubmitting(true, this);
      }
    });
  }

  endSubmission (cb) {
    this.setState({
      isSubmitting: false,
    }, cb);
    this.registeredControls.forEach((input) => {
      if (input.setFormSubmitting) {
        input.setFormSubmitting(false, this);
      }
    });
  }

}
