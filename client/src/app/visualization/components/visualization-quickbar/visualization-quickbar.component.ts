import {
    Component,
    EventEmitter,
    Output,
} from '@angular/core';
import { MatLegacySlideToggleChange } from '@angular/material/legacy-slide-toggle';

@Component({
    selector: 'app-visualization-quickbar',
    templateUrl: './visualization-quickbar.component.html',
    styleUrls: ['./visualization-quickbar.component.scss'],
})
export class VisualizationQuickbarComponent {
    @Output() animationStatus = new EventEmitter<boolean>();

    constructor() {}

    animationToggle($event: MatLegacySlideToggleChange) {
        this.animationStatus.emit($event.checked);
    }
}
