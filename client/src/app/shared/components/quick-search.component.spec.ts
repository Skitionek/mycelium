import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CommonModule } from '@angular/common';


import { QuickSearchComponent } from './quick-search.component';

describe('QuickSearchComponent', () => {
    let component: QuickSearchComponent;
    let fixture: ComponentFixture<QuickSearchComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [QuickSearchComponent],
            imports: [CommonModule],
        })
    .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(QuickSearchComponent);
        component = fixture.componentInstance;
    });

    function renderedLabels(): string[] {
        fixture.detectChanges();
        return Array.from(fixture.nativeElement.querySelectorAll('a'))
            .map((a: HTMLAnchorElement) => a.textContent.trim());
    }

    it('should label generated links without the underscores in their domain', () => {
        component.query = 'MAPK1';
        component.ngOnChanges();
        expect(renderedLabels().slice(0, 2)).toEqual(['NCBI Taxonomy', 'NCBI Gene']);
    });

    it('should order given links like SEARCH_LINKS whatever their case', () => {
        component.links = [
            { domain: 'Google', url: 'https://www.google.com/search?q=MAPK1' },
            { domain: 'UniProt', url: 'https://www.uniprot.org/uniprot/?query=MAPK1' },
            { domain: 'NCBI_Gene', url: 'https://www.ncbi.nlm.nih.gov/gene/?term=MAPK1' },
        ];
        component.ngOnChanges();
        expect(renderedLabels()).toEqual(['NCBI Gene', 'UniProt', 'Google']);
    });
});
