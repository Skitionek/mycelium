import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';

import { ChartOptions, ChartType, Point } from 'chart.js';

import { EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';

const mapTootipItem = func =>
  ({datasetIndex, index}, {datasets}) => {
    return func(datasets[datasetIndex].data[index]);
  };

const mapSingularOfTootipItems = func => {
  const wrappedFunc = mapTootipItem(func);
  return ([tootipItem], object) =>
    wrappedFunc(tootipItem, object);
};

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ChartComponent implements OnChanges {
  public options: ChartOptions = ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        ticks: {
          stepSize: 1,
        },
        grid: {
          drawOnChartArea: false
        },
        offset: true,
        type: 'logarithmic',
        title: {
          display: true,
          text: '-log(q-value)'
        }
      },
    },
    plugins: {
      // Change options for ALL labels of THIS CHART
      datalabels: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'y',
        intersect: false,
        callbacks: {
          title: mapSingularOfTootipItems(({gene}) => gene),
          label: mapTootipItem(d => `q-value: ${d['q-value'].toExponential(2)}`)
        }
      }
    },
  } as any) as ChartOptions;
  public chartType: ChartType = 'bar';
  legend = false;

  @Input() showMore: boolean;
  @Input() data: EnrichWithGOTermsResult[];
  @Input() show: boolean;

  slicedData: (EnrichWithGOTermsResult & Point)[];
  labels: string[];

  ngOnChanges({show, data, showMore}: SimpleChanges) {
    if (this.show && (show || data || showMore)) {
      const slicedNotFormatedData = this.showMore ? this.data.slice(0, 50) : this.data.slice(0, 10);
      this.slicedData = slicedNotFormatedData.map((d: any, i) => ({
        ...d,
        x: -Math.log(d['q-value'])
      }));
      this.labels = slicedNotFormatedData.map(({gene}) => gene);
    }
  }
}
