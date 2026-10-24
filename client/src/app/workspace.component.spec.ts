import { WorkspaceComponent } from 'app/workspace.component';

describe('WorkspaceComponent', () => {
    // Pure, so it is exercised without standing up the whole workspace.
    const calculateFontAwesomeIcon = WorkspaceComponent.prototype.calculateFontAwesomeIcon;

    it('should give tabs without an icon the window icon', () => {
        expect(calculateFontAwesomeIcon(null)).toBe('fa fa-window-maximize');
        expect(calculateFontAwesomeIcon(undefined)).toBe('fa fa-window-maximize');
    });

    it('should prefix a bare icon name', () => {
        expect(calculateFontAwesomeIcon('file-pdf')).toBe('fa fa-file-pdf');
    });

    it('should pass full icon classes through', () => {
        expect(calculateFontAwesomeIcon('fas fa-chart-network')).toBe('fas fa-chart-network');
    });
});
