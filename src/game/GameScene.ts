import Phaser from 'phaser';
import {
  applyMove,
  BLUE,
  canPlayCell,
  createInitialState,
  getStatusMessage,
  RED,
  type GameState,
  type OuterStatus,
} from './logic';

const COLORS = {
  bg: 0x1a1a2e,
  boardBg: 0x16213e,
  line: 0x4a5568,
  blue: 0x2196f3,
  blueDark: 0x1565c0,
  red: 0xf44336,
  redDark: 0xc62828,
  draw: 0x607d8b,
  text: 0xffffff,
  muted: 0xb0bec5,
  highlight: 0xffd54f,
  button: 0x37474f,
  buttonHover: 0x455a64,
};

interface CellRef {
  outer: number;
  inner: number;
  zone: Phaser.GameObjects.Rectangle;
  mark: Phaser.GameObjects.Arc | null;
}

export class GameScene extends Phaser.Scene {
  private state: GameState = createInitialState();
  private boardLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private overlayLayer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private cells: CellRef[] = [];
  private outerOverlays: Phaser.GameObjects.Container[] = [];
  private layout = { boardSize: 0, offsetX: 0, offsetY: 0, headerHeight: 72 };

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.boardLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0).setDepth(20);

    this.statusText = this.add
      .text(0, 0, getStatusMessage(this.state), {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.createRestartButton();
    this.uiLayer.add(this.statusText);

    this.scale.on('resize', this.handleResize, this);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
  }

  private createRestartButton(): void {
    const btnW = 140;
    const btnH = 44;
    const bg = this.add
      .rectangle(0, 0, btnW, btnH, COLORS.button, 1)
      .setStrokeStyle(2, COLORS.muted)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(0, 0, 'Restart', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const container = this.add.container(0, 0, [bg, label]);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.buttonHover));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.button));
    bg.on('pointerdown', () => this.restartGame());

    container.setData('bg', bg);
    this.uiLayer.add(container);
    this.uiLayer.setData('restartBtn', container);
  }

  private handleResize(gameSize: { width: number; height: number }): void {
    const { width, height } = gameSize;
    const headerHeight = Math.max(72, Math.min(96, height * 0.1));
    this.layout.headerHeight = headerHeight;

    const available = Math.min(width - 24, height - headerHeight - 24);
    this.layout.boardSize = Math.max(280, available);
    this.layout.offsetX = (width - this.layout.boardSize) / 2;
    this.layout.offsetY = headerHeight + (height - headerHeight - this.layout.boardSize) / 2;

    this.statusText.setPosition(width / 2, 16);
    this.statusText.setFontSize(`${Math.max(18, Math.min(28, width * 0.045))}px`);

    const restartBtn = this.uiLayer.getData('restartBtn') as Phaser.GameObjects.Container;
    restartBtn.setPosition(width - 90, 36);

    this.rebuildBoard();
    this.refreshVisuals();
  }

  private rebuildBoard(): void {
    this.boardLayer.removeAll(true);
    this.cells = [];
    this.outerOverlays = [];

    const { boardSize, offsetX, offsetY } = this.layout;
    const outerGap = boardSize * 0.025;
    const outerCell = (boardSize - outerGap * 4) / 3;

    for (let outer = 0; outer < 9; outer++) {
      const row = Math.floor(outer / 3);
      const col = outer % 3;
      const ox = offsetX + outerGap + col * (outerCell + outerGap);
      const oy = offsetY + outerGap + row * (outerCell + outerGap);

      const outerBg = this.add.rectangle(ox + outerCell / 2, oy + outerCell / 2, outerCell, outerCell, COLORS.boardBg);
      outerBg.setStrokeStyle(Math.max(1, outerCell * 0.008), COLORS.line);
      this.boardLayer.add(outerBg);

      const overlayContainer = this.add.container(ox, oy);
      this.outerOverlays[outer] = overlayContainer;
      this.boardLayer.add(overlayContainer);

      const innerPad = outerCell * 0.06;
      const innerArea = outerCell - innerPad * 2;
      const innerCell = innerArea / 3;

      for (let inner = 0; inner < 9; inner++) {
        const iRow = Math.floor(inner / 3);
        const iCol = inner % 3;
        const cx = ox + innerPad + iCol * innerCell + innerCell / 2;
        const cy = oy + innerPad + iRow * innerCell + innerCell / 2;

        const zone = this.add
          .rectangle(cx, cy, innerCell * 0.92, innerCell * 0.92, 0x000000, 0)
          .setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => this.onCellClick(outer, inner));
        zone.on('pointerover', () => {
          if (canPlayCell(this.state, outer, inner)) {
            zone.setFillStyle(COLORS.highlight, 0.15);
          }
        });
        zone.on('pointerout', () => zone.setFillStyle(0x000000, 0));

        this.boardLayer.add(zone);
        this.cells.push({ outer, inner, zone, mark: null });
      }

      this.drawInnerGridLines(ox, oy, outerCell, innerPad, innerArea);
    }
  }

  private drawInnerGridLines(
    ox: number,
    oy: number,
    outerCell: number,
    innerPad: number,
    innerArea: number,
  ): void {
    const lineW = Math.max(1, outerCell * 0.012);
    const graphics = this.add.graphics();
    graphics.lineStyle(lineW, COLORS.line, 0.9);

    for (let i = 1; i <= 2; i++) {
      const x = ox + innerPad + (innerArea / 3) * i;
      const y = oy + innerPad + (innerArea / 3) * i;
      graphics.lineBetween(x, oy + innerPad, x, oy + innerPad + innerArea);
      graphics.lineBetween(ox + innerPad, y, ox + innerPad + innerArea, y);
    }

    this.boardLayer.add(graphics);
  }

  private onCellClick(outerIndex: number, innerIndex: number): void {
    if (!canPlayCell(this.state, outerIndex, innerIndex)) return;

    this.state = applyMove(this.state, outerIndex, innerIndex);
    this.refreshVisuals();
    this.statusText.setText(getStatusMessage(this.state));

    if (this.state.gameOver) {
      this.showGameOverOverlay();
    }
  }

  private refreshVisuals(): void {
    const { boardSize, offsetX, offsetY } = this.layout;
    const outerGap = boardSize * 0.025;
    const outerCell = (boardSize - outerGap * 4) / 3;
    const innerPad = outerCell * 0.06;
    const innerArea = outerCell - innerPad * 2;
    const innerCell = innerArea / 3;
    const markRadius = innerCell * 0.28;

    for (const cell of this.cells) {
      const player = this.state.innerBoards[cell.outer]![cell.inner]!;
      if (cell.mark) {
        cell.mark.destroy();
        cell.mark = null;
      }

      if (player !== 0) {
        const row = Math.floor(cell.inner / 3);
        const col = cell.inner % 3;
        const oRow = Math.floor(cell.outer / 3);
        const oCol = cell.outer % 3;
        const ox = offsetX + outerGap + oCol * (outerCell + outerGap);
        const oy = offsetY + outerGap + oRow * (outerCell + outerGap);
        const cx = ox + innerPad + col * innerCell + innerCell / 2;
        const cy = oy + innerPad + row * innerCell + innerCell / 2;

        const color = player === BLUE ? COLORS.blue : COLORS.red;
        cell.mark = this.add.circle(cx, cy, markRadius, color).setStrokeStyle(Math.max(2, markRadius * 0.15), 0xffffff);
        this.boardLayer.add(cell.mark);
      }

      const playable = canPlayCell(this.state, cell.outer, cell.inner);
      cell.zone.setInteractive(playable ? { useHandCursor: true } : false);
    }

    for (let outer = 0; outer < 9; outer++) {
      this.updateOuterOverlay(outer);
    }
  }

  private updateOuterOverlay(outerIndex: number): void {
    const container = this.outerOverlays[outerIndex]!;
    container.removeAll(true);

    const status: OuterStatus = this.state.outerStatus[outerIndex]!;
    if (status === 'neutral') return;

    const { boardSize, offsetX, offsetY } = this.layout;
    const outerGap = boardSize * 0.025;
    const outerCell = (boardSize - outerGap * 4) / 3;
    const row = Math.floor(outerIndex / 3);
    const col = outerIndex % 3;
    const ox = offsetX + outerGap + col * (outerCell + outerGap);
    const oy = offsetY + outerGap + row * (outerCell + outerGap);

    let fillColor = COLORS.draw;
    let label = '—';
    let labelColor = '#eceff1';

    if (status === 'blue') {
      fillColor = COLORS.blueDark;
      label = 'B';
      labelColor = '#ffffff';
    } else if (status === 'red') {
      fillColor = COLORS.redDark;
      label = 'R';
      labelColor = '#ffffff';
    }

    const overlay = this.add
      .rectangle(outerCell / 2, outerCell / 2, outerCell, outerCell, fillColor, status === 'draw' ? 0.75 : 0.82)
      .setStrokeStyle(Math.max(2, outerCell * 0.015), 0xffffff, 0.5);

    const badge = this.add
      .text(outerCell / 2, outerCell / 2, label, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: `${outerCell * 0.42}px`,
        color: labelColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    container.add([overlay, badge]);
    container.setPosition(ox, oy);
  }

  private showGameOverOverlay(): void {
    this.overlayLayer.removeAll(true);

    const { width, height } = this.scale;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);
    const message = getStatusMessage(this.state);
    const msgColor = this.state.winner === BLUE ? '#64b5f6' : this.state.winner === RED ? '#ef5350' : '#b0bec5';

    const title = this.add
      .text(width / 2, height / 2 - 20, message, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: `${Math.max(28, Math.min(48, width * 0.07))}px`,
        color: msgColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height / 2 + 36, 'Tap Restart to play again', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: `${Math.max(14, Math.min(20, width * 0.035))}px`,
        color: '#cfd8dc',
      })
      .setOrigin(0.5);

    this.overlayLayer.add([dim, title, hint]);
  }

  private restartGame(): void {
    this.state = createInitialState();
    this.overlayLayer.removeAll(true);
    this.statusText.setText(getStatusMessage(this.state));
    this.refreshVisuals();
  }
}
