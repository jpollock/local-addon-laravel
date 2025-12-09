/**
 * Theme-Aware Component Example
 *
 * Demonstrates best practices for dark mode implementation in Local addons.
 * This example shows:
 * - Class-based React component (required for Local)
 * - Using Local's theme system (SASS mixins)
 * - Proper component structure
 * - Accessibility considerations
 * - Smooth transitions
 */

import * as React from 'react';
import * as styles from './ThemeAwareComponent.scss';

interface Props {
  title: string;
  description?: string;
  onAction?: () => void;
}

interface State {
  isExpanded: boolean;
  items: string[];
}

export default class ThemeAwareComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isExpanded: true,
      items: ['Item 1', 'Item 2', 'Item 3']
    };

    // Bind methods
    this.toggleExpanded = this.toggleExpanded.bind(this);
    this.handleAction = this.handleAction.bind(this);
    this.addItem = this.addItem.bind(this);
  }

  toggleExpanded() {
    this.setState(prevState => ({
      isExpanded: !prevState.isExpanded
    }));
  }

  handleAction() {
    if (this.props.onAction) {
      this.props.onAction();
    }
  }

  addItem() {
    this.setState(prevState => ({
      items: [...prevState.items, `Item ${prevState.items.length + 1}`]
    }));
  }

  render() {
    const { title, description } = this.props;
    const { isExpanded, items } = this.state;

    return (
      <div className={styles.container}>
        {/* Header Section */}
        <div className={styles.header} onClick={this.toggleExpanded}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>{title}</h2>
            {description && (
              <p className={styles.description}>{description}</p>
            )}
          </div>
          <span className={styles.toggleIcon}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>

        {/* Expandable Content */}
        {isExpanded && (
          <div className={styles.content}>
            {/* List Section */}
            <div className={styles.listSection}>
              <h3 className={styles.sectionTitle}>Items</h3>
              <ul className={styles.list}>
                {items.map((item, index) => (
                  <li key={index} className={styles.listItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                onClick={this.addItem}
              >
                Add Item
              </button>

              <button
                className={styles.secondaryButton}
                onClick={this.handleAction}
              >
                Custom Action
              </button>
            </div>

            {/* Info Card */}
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>ℹ</div>
              <div className={styles.infoContent}>
                <h4 className={styles.infoTitle}>Theme Information</h4>
                <p className={styles.infoText}>
                  This component automatically adapts to light and dark themes
                  using Local's theme system. All colors, borders, and backgrounds
                  adjust based on the current theme.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
