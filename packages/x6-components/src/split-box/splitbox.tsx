import React from 'react'
import clamp from 'clamp'
import classNames from 'classnames'
import { Box } from './box'
import { Resizer } from './resizer'

export class SplitBox extends React.PureComponent<
  SplitBox.Props,
  SplitBox.State
> {
  private container: HTMLDivElement
  private box1Elem: HTMLDivElement
  private box2Elem: HTMLDivElement
  private maskElem: HTMLDivElement

  private minSize: number
  private maxSize: number
  private curSize: number
  private rawSize: number
  private resizing: boolean

  constructor(props: SplitBox.Props) {
    super(props)
    this.state = this.getNextState(props)
  }

  componentWillReceiveProps(nextProps: SplitBox.Props) {
    const nextState = this.getNextState(nextProps)
    this.setState(nextState)
  }

  getNextState(props: SplitBox.Props): SplitBox.State {
    const { size, defaultSize, primary } = props
    const initialSize =
      size !== undefined
        ? size
        : defaultSize !== undefined
        ? defaultSize
        : undefined

    return {
      box1Size: primary === 'first' ? initialSize : undefined,
      box2Size: primary === 'second' ? initialSize : undefined,
    }
  }

  isVertical() {
    return this.props.split === 'vertical'
  }

  isPrimaryFirst() {
    return this.props.primary === 'first'
  }

  getDelta(deltaX: number, deltaY: number) {
    const { step } = this.props
    const isVertical = this.isVertical()
    const isPrimaryFirst = this.isPrimaryFirst()

    let delta = isVertical ? deltaX : deltaY
    if (delta === 0) {
      return 0
    }

    if (step && Math.abs(delta) >= step) {
      delta = ~~(delta / step) * step
    }

    delta = isPrimaryFirst ? -delta : delta

    const primaryBox = isPrimaryFirst ? this.box1Elem : this.box2Elem
    const secondBox = isPrimaryFirst ? this.box2Elem : this.box1Elem
    const box1Order = parseInt(window.getComputedStyle(primaryBox).order!, 10)
    const box2Order = parseInt(window.getComputedStyle(secondBox).order!, 10)
    if (box1Order > box2Order) {
      delta = -delta
    }

    return delta
  }

  getRange() {
    const { maxSize, minSize } = this.props
    const containerRect = this.container.getBoundingClientRect()
    const containerSize = this.isVertical()
      ? containerRect.width
      : containerRect.height

    let newMinSize = minSize !== undefined ? minSize : 0
    let newMaxSize = maxSize !== undefined ? maxSize : 0

    while (newMinSize < 0) {
      newMinSize = containerSize + newMinSize
    }

    while (newMaxSize <= 0) {
      newMaxSize = containerSize + newMaxSize
    }

    return {
      minSize: clamp(newMinSize, 0, containerSize),
      maxSize: clamp(newMaxSize, 0, containerSize),
    }
  }

  getPrimarySize() {
    const primaryBox = this.isPrimaryFirst() ? this.box1Elem : this.box2Elem
    return this.isVertical()
      ? primaryBox.getBoundingClientRect().width
      : primaryBox.getBoundingClientRect().height
  }

  setPrimarySize(size: number) {
    const styleName = this.isVertical() ? 'width' : 'height'
    const primaryBox = this.isPrimaryFirst() ? this.box1Elem : this.box2Elem

    primaryBox.style.flex = 'none'
    primaryBox.style[styleName] = `${size}px`
  }

  updateCursor(size: number, minSize: number, maxSize: number) {
    let cursor = ''
    if (this.isVertical()) {
      if (size === minSize) {
        cursor = this.isPrimaryFirst() ? 'e-resize' : 'w-resize'
      } else if (size === maxSize) {
        cursor = this.isPrimaryFirst() ? 'w-resize' : 'e-resize'
      } else {
        cursor = 'col-resize'
      }
    } else {
      if (size === minSize) {
        cursor = this.isPrimaryFirst() ? 's-resize' : 'n-resize'
      } else if (size === maxSize) {
        cursor = this.isPrimaryFirst() ? 'n-resize' : 's-resize'
      } else {
        cursor = 'row-resize'
      }
    }

    this.maskElem.style.cursor = cursor
  }

  createMask() {
    const mask = document.createElement('div')
    mask.style.position = 'absolute'
    mask.style.top = '0'
    mask.style.right = '0'
    mask.style.bottom = '0'
    mask.style.left = '0'
    mask.style.zIndex = '9999'
    document.body.appendChild(mask)
    this.maskElem = mask
  }

  removeMask() {
    if (this.maskElem.parentNode) {
      this.maskElem.parentNode.removeChild(this.maskElem)
    }
  }

  onMouseDown = () => {
    const { maxSize, minSize } = this.getRange()
    this.minSize = minSize
    this.maxSize = maxSize
    this.curSize = this.getPrimarySize()
    this.rawSize = this.curSize
    this.resizing = true

    this.createMask()
    this.updateCursor(this.curSize, minSize, maxSize)
  }

  onMouseMove = (deltaX: number, deltaY: number) => {
    if (this.props.resizable && this.resizing) {
      const delta = this.getDelta(deltaX, deltaY)
      if (delta === 0) {
        return
      }

      if (this.rawSize < this.minSize || this.rawSize > this.maxSize) {
        this.rawSize -= delta
        return
      }

      this.rawSize -= delta
      this.curSize = this.rawSize
      this.curSize = clamp(this.curSize, this.minSize, this.maxSize)

      this.setPrimarySize(this.curSize)
      this.updateCursor(this.curSize, this.minSize, this.maxSize)
      if (this.props.onResizing) {
        this.props.onResizing(this.curSize)
      }
    }
  }

  onMouseMoveEnd = () => {
    if (this.props.resizable && this.resizing) {
      if (this.props.onResizeEnd) {
        this.props.onResizeEnd(this.curSize)
      }

      if (this.props.refresh) {
        const isPrimaryFirst = this.isPrimaryFirst()
        this.setState({
          box1Size: isPrimaryFirst ? this.curSize : undefined,
          box2Size: isPrimaryFirst ? undefined : this.curSize,
        })
      }

      this.resizing = false
      this.removeMask()
    }
  }

  refContainer = (container: HTMLDivElement) => {
    this.container = container
  }

  renderBox(baseCls: string, index: 1 | 2) {
    const primary = index === 1 ? 'first' : 'second'
    const isPrimary = this.props.primary === primary
    const size = index === 1 ? this.state.box1Size : this.state.box2Size
    const style = {
      ...this.props.boxStyle,
      ...(isPrimary ? this.props.primaryBoxStyle : this.props.secondBoxStyle),
    }

    const classes = classNames(
      `${baseCls}-item`,
      isPrimary ? `${baseCls}-item-primary` : `${baseCls}-item-second`
    )

    const ref = (elem: HTMLDivElement) => {
      if (index === 1) {
        this.box1Elem = elem
      } else {
        this.box2Elem = elem
      }
    }

    const children = this.props.children as any

    return (
      <Box
        key={`box${index}`}
        refIt={ref}
        size={size}
        style={style}
        className={classes}
        split={this.props.split}
      >
        {children[index - 1]}
      </Box>
    )
  }

  renderResizer(baseCls: string) {
    return (
      <Resizer
        key="resizer"
        className={`${baseCls}-resizer`}
        style={this.props.resizerStyle}
        onClick={this.props.onResizerClick}
        onDoubleClick={this.props.onResizerDoubleClick}
        onMouseDown={this.onMouseDown}
        onMouseMove={this.onMouseMove}
        onMouseMoveEnd={this.onMouseMoveEnd}
      />
    )
  }

  render() {
    const style: React.CSSProperties = {
      flex: 1,
      flexShrink: 0,
      display: 'flex',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      height: '100%',
      ...this.props.style,
    }

    if (this.props.split === 'vertical') {
      style.flexDirection = 'row'
    } else {
      style.flexDirection = 'column'
    }

    const baseCls = `${this.props.prefixCls}-split-box`

    const classes = classNames(baseCls, `${baseCls}-${this.props.split}`, {
      [`${baseCls}-disabled`]: !this.props.resizable,
    })

    return (
      <div style={style} className={classes} ref={this.refContainer}>
        {this.renderBox(baseCls, 1)}
        {this.renderResizer(baseCls)}
        {this.renderBox(baseCls, 2)}
      </div>
    )
  }
}

export namespace SplitBox {
  export interface Props {
    split?: 'vertical' | 'horizontal'
    primary?: 'first' | 'second'
    resizable?: boolean
    /**
     * Rerender after resize.
     */
    refresh?: boolean
    size?: number | string
    minSize?: number
    maxSize?: number
    defaultSize?: number | string
    step?: number
    prefixCls?: string
    style?: React.CSSProperties
    boxStyle?: React.CSSProperties
    primaryBoxStyle?: React.CSSProperties
    secondBoxStyle?: React.CSSProperties
    resizerStyle?: React.CSSProperties
    onResizeStart?: () => void
    onResizeEnd?: (newSize: number) => void
    onResizing?: (newSize: number) => void
    onResizerClick?: () => void
    onResizerDoubleClick?: () => void
  }

  export const defaultProps = {
    resizable: true,
    split: 'vertical',
    primary: 'first',
    prefixCls: 'x6',
  }

  export interface State {
    box1Size?: number | string
    box2Size?: number | string
  }
}
