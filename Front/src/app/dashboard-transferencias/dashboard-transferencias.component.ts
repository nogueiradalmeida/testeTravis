declare var google: any;

import { Component, OnInit, NgZone, ViewChild } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { DashboardTransferencia } from './DashboardTransferencia';
import { Web3Service } from './../Web3Service';
import { PessoaJuridicaService } from '../pessoa-juridica.service';

import { GoogleMapsService, Marcador, MarcadorLinha } from '../shared/google-maps.service';

import { BnAlertsService } from 'bndes-ux4';

import { LiquidacaoResgate } from '../liquidacao-resgate/liquidacao-resgate'

import { Transferencia } from '../transferencia/Transferencia';

@Component({
  selector: 'app-dashboard-transferencias',
  templateUrl: './dashboard-transferencias.component.html',
  styleUrls: ['./dashboard-transferencias.component.css']
})
export class DashboardTransferenciasComponent implements OnInit {

  public pieChartData: any = {
    chartType: 'PieChart',
    dataTable: [
      ['tipo', 'valores'],
      ['Liberação', 0],
      ['Ordem de pagamento', 0],
      ['Solicitação de Resgate', 0],
      ['Liquidação de Resgate', 0]
    ],
    options: { 'title': 'Tipos de Transações' },
  };

  public barChartData: any = {
    chartType: 'Bar',
    data: {},
    dataTable: [
      ['Tipo', 'Volume'],
      ['Liberação', 0],
      ['Pagamento', 0],
      ['Solicitação', 0],
      ['Liquidação Resgate', 0]
    ]
  };

  public contadorLiberacao: number;
  public contadorResgate: number;
  public contadorTransferencia: number;
  public contadorLiquidacao: number;

  public volumeLiberacao: number;
  public volumeResgate: number;
  public volumeTransferencia: number;
  public volumeLiquidacao: number;

  listaTransferencias: DashboardTransferencia[] = undefined;
  estadoLista: string = "undefined"

  p: number = 1;
  order: string = 'dataHora';
  reverse: boolean = true;

  marcadores: Marcador[] = []
  marcadoresLinha: MarcadorLinha[] = []
  latitudeInicial: number = -15.7942287;
  longitudeInicial: number = -47.8821658;
  zoom: number = 6;

  isActive: boolean[] = []
  mapaEstaAtivo: boolean = false
  labelMap: string[] = ["A", "B"]

  @ViewChild('pieChart') pieChart;
  @ViewChild('barChart') barChart;

  razaoSocialBNDES: string = "Banco Nacional De Desenvolvimento Econômico E Social";

  constructor(private pessoaJuridicaService: PessoaJuridicaService, protected bnAlertsService: BnAlertsService,
    private web3Service: Web3Service, private ref: ChangeDetectorRef, private zone: NgZone, private mapa: GoogleMapsService) { }

  ngOnInit() {

    this.contadorLiberacao = 0;
    this.contadorResgate = 0;
    this.contadorTransferencia = 0;
    this.contadorLiquidacao = 0;

    this.volumeLiberacao = 0;
    this.volumeResgate = 0;
    this.volumeTransferencia = 0;
    this.volumeLiquidacao = 0;

    setTimeout(() => {
      this.listaTransferencias = [];

      this.registrarExibicaoEventos();
    }, 1500)

    setTimeout(() => {
      this.estadoLista = this.estadoLista === "undefined" ? "vazia" : "cheia"
      this.ref.detectChanges()
    }, 2000)

  }

  atualizaGrafico() {
    if (this.pieChart != undefined && this.barChart != undefined) {
      if (this.pieChart.wrapper != undefined && this.barChart != undefined) {
        let pieDataTable = this.pieChart.wrapper.getDataTable();
        let barDataTable = this.barChart.wrapper.getDataTable();

        pieDataTable.setValue(0, 1, this.contadorLiberacao)
        pieDataTable.setValue(1, 1, this.contadorTransferencia)
        pieDataTable.setValue(2, 1, this.contadorResgate)
        pieDataTable.setValue(3, 1, this.contadorLiquidacao)

        barDataTable.setValue(0, 1, this.volumeLiberacao)
        barDataTable.setValue(1, 1, this.volumeTransferencia)
        barDataTable.setValue(2, 1, this.volumeResgate)
        barDataTable.setValue(3, 1, this.volumeLiquidacao)

        this.pieChart.redraw();
        this.barChart.redraw();
      }
    }
  }

  registrarExibicaoEventos() {

    let self = this;

    // EVENTOS LIBERAÇÃO
    this.registrarExibicaoEventosLiberacao()

    // EVENTOS TRANSFERÊNCIA
    this.registrarExibicaoEventosTransferencia()

    // EVENTOS REPASSE
    this.registrarExibicaoEventosRepasse()

    // EVENTOS RESGATE
    this.registrarExibicaoEventosResgate()

    // EVENTOS LIQUIDAÇÃO RESGATE
    this.registrarExibicaoEventosLiquidacaoResgate()

    console.log("antes de atualizar - contador liberacao " + self.contadorLiberacao);
    console.log("antes de atualizar - contador transferencia " + self.contadorTransferencia);
    console.log("antes de atualizar - contador resgate " + self.contadorResgate);
    console.log("antes de atualizar - contador liquidacao " + self.contadorLiquidacao);

    console.log("antes de atualizar - volume liberacao " + self.volumeLiberacao);
    console.log("antes de atualizar - volume transferencia " + self.volumeTransferencia);
    console.log("antes de atualizar - volume resgate " + self.volumeResgate);
    console.log("antes de atualizar - volume liquidacao " + self.volumeLiquidacao);

    this.estadoLista = "vazia"
  }

  setOrder(value: string) {
    if (this.order === value) {
      this.reverse = !this.reverse;
    }
    this.order = value;
    this.ref.detectChanges();
  }

  customComparator(itemA, itemB) {
    return itemB - itemA;
  }

  selecionaTransacao(position: number, transferencia: DashboardTransferencia) {

    scrollTo(0, 100000);

    this.marcadores = []
    this.marcadoresLinha = []

    if (this.isActive[position]) {
      this.isActive[position] = false
      this.mapaEstaAtivo = false
    } else {
      this.isActive = new Array(this.listaTransferencias.length).fill(false)
      this.isActive[position] = true
      this.mapaEstaAtivo = true

      let cnpjOrigem = transferencia.deCnpj
      let cnpjDestino = transferencia.paraCnpj

      this.exibirTransferenciaNoMapa([transferencia.deCnpj, transferencia.paraCnpj])
    }

  }

  exibirTransferenciaNoMapa(listaCnpj: string[]) {

    let self = this

    for (var i = 0; i < listaCnpj.length; i++) {

      this.pessoaJuridicaService.recuperaEmpresaPorCnpj(listaCnpj[i]).subscribe(
        data => {
          console.log("EMPRESA RECUPERADA PELO CNPJ")

          let cidade = data ? data.dadosCadastrais.cidade : "Rio de janeiro"

          this.mapa.converteCidadeEmCoordenadas(cidade, (result) => {

            this.marcadores.push({
              lat: result[0],
              lng: result[1],
              draggable: true,
              info: data ? data.dadosCadastrais.razaoSocial : "Banco Nacional de Desenvolvimento Econômico e Social"
            })

          })

          setTimeout(() => {
            this.latitudeInicial = this.marcadores[0].lat
            this.longitudeInicial = this.marcadores[0].lng

            this.marcadoresLinha.push({
              latA: this.marcadores[0].lat,
              lngA: this.marcadores[0].lng,
              latB: this.marcadores[1].lat,
              lngB: this.marcadores[1].lng
            })

            this.ref.detectChanges()
          }, 500)

        },
        error => {
          console.log("Erro ao encontrar a empresa")
        }
      )
    }

  }

  registrarExibicaoEventosLiberacao() {
    let self = this

    this.web3Service.registraEventosLiberacao(function (error, event) {
      if (!error) {
        let liberacao: DashboardTransferencia;
        let eventoLiberacao = event

        self.pessoaJuridicaService.recuperaEmpresaPorCnpj(eventoLiberacao.args.cnpj).subscribe(
          data => {

            let subcredito

            for (var i = 0; i < data.subcreditos.length; i++) {
              if (eventoLiberacao.args.idSubcredito == data.subcreditos[i].numero) {
                subcredito = data.subcreditos[i].nome + " - " + data.subcreditos[i].numero
              }
            }

            liberacao = {
              deRazaoSocial: self.razaoSocialBNDES,
              deCnpj: "BNDES",
              deConta: "-",
              paraRazaoSocial: data.dadosCadastrais.razaoSocial,
              paraCnpj: eventoLiberacao.args.cnpj,
              paraConta: subcredito,
              valor: self.web3Service.converteInteiroParaDecimal(parseInt(eventoLiberacao.args.valor)),
              tipo: "Liberação",
              hashID: eventoLiberacao.transactionHash,
              dataHora: null
            };

            // Colocar dentro da zona do Angular para ter a atualização de forma correta
            self.zone.run(() => {
              self.listaTransferencias.push(liberacao);
              self.estadoLista = "cheia"
            });

            self.contadorLiberacao++;
            self.volumeLiberacao += self.web3Service.converteInteiroParaDecimal(parseInt(eventoLiberacao.args.valor));

            self.pieChartData.dataTable[1][1] = self.contadorLiberacao;
            self.barChartData.dataTable[1][1] = self.volumeLiberacao;

            self.atualizaGrafico();

            console.log("inseriu liberacao " + liberacao.hashID);
            console.log("contador liberacao " + self.contadorLiberacao);
            console.log("volume liberacao " + self.volumeLiberacao);

            self.web3Service.getBlockTimestamp(eventoLiberacao.blockHash,
              function (error, result) {
                if (!error) {
                  liberacao.dataHora = new Date(result.timestamp * 1000);
                  self.ref.detectChanges();
                  //TODO: adicionar tratamento para o grafico de barras
                }
                else {
                  console.log("Erro ao recuperar data e hora do bloco");
                  console.error(error);
                }
              });
          },
          error => {
            console.log("Erro ao recuperar empresa por CNPJ do evento liberação")
          }
        )

      }
      else {
        console.log("Erro no registro de eventos de liberacao");
        console.log(error);
      }

    });
  }

  registrarExibicaoEventosTransferencia() {
    let self = this

    this.web3Service.registraEventosTransferencia(function (error, event) {
      if (!error) {
        let transferencia: DashboardTransferencia;
        let eventoTransferencia = event

        self.pessoaJuridicaService.recuperaEmpresaPorCnpj(eventoTransferencia.args.fromCnpj).subscribe(
          (data) => {
            let fromRazaoSocial = data.dadosCadastrais.razaoSocial
            let subcredito

            for (var i = 0; i < data.subcreditos.length; i++) {
              if (eventoTransferencia.args.fromSubcredito == data.subcreditos[i].numero) {
                subcredito = data.subcreditos[i].nome + " - " + data.subcreditos[i].numero
              }
            }

            self.pessoaJuridicaService.recuperaEmpresaPorCnpj(eventoTransferencia.args.toCnpj).subscribe(
              data => {
                console.log(data)
                let toRazaoSocial = data.dadosCadastrais.razaoSocial

                transferencia = {
                  deRazaoSocial: fromRazaoSocial,
                  deCnpj: eventoTransferencia.args.fromCnpj,
                  deConta: subcredito,
                  paraRazaoSocial: toRazaoSocial,
                  paraCnpj: eventoTransferencia.args.toCnpj,
                  paraConta: "-",
                  valor: self.web3Service.converteInteiroParaDecimal(parseInt(eventoTransferencia.args.valor)),
                  tipo: "Ordem de Pagamento",
                  hashID: eventoTransferencia.transactionHash,
                  dataHora: null
                };

                // Colocar dentro da zona do Angular para ter a atualização de forma correta
                self.zone.run(() => {
                  self.listaTransferencias.push(transferencia);
                  self.estadoLista = "cheia"
                })

                self.contadorTransferencia++;
                self.volumeTransferencia += self.web3Service.converteInteiroParaDecimal(parseInt(eventoTransferencia.args.valor));

                self.pieChartData.dataTable[2][1] = self.contadorTransferencia;
                self.barChartData.dataTable[2][1] = self.volumeTransferencia;

                self.atualizaGrafico();

                console.log("inseriu transf " + transferencia.hashID);
                console.log("contador transf " + self.contadorTransferencia);
                console.log("volume transf " + self.volumeTransferencia);

                self.web3Service.getBlockTimestamp(eventoTransferencia.blockHash,
                  function (error, result) {
                    if (!error) {
                      transferencia.dataHora = new Date(result.timestamp * 1000);
                      self.ref.detectChanges();
                    }
                    else {
                      console.log("Erro ao recuperar data e hora do bloco");
                      console.error(error);
                    }
                  });
              },
              error => {
                console.log("Erro ao recuperar a empresa por cnpj do evento transferencia")
              })
          })
      }
      else {
        console.log("Erro no registro de eventos transferência");
        console.log(error);
      }

    });
  }

  registrarExibicaoEventosRepasse() {
    let self = this

    this.web3Service.registraEventosRepasse(function (error, event) {
      if (!error) {
        let transferencia: DashboardTransferencia;
        let eventoRepasse = event

        self.pessoaJuridicaService.recuperaEmpresaPorCnpj(eventoRepasse.args.fromCnpj).subscribe(
          (data) => {
            let fromRazaoSocial = data.dadosCadastrais.razaoSocial
            let subcredito

            for (var i = 0; i < data.subcreditos.length; i++) {
              if (eventoRepasse.args.fromSubcredito == data.subcreditos[i].numero) {
                subcredito = data.subcreditos[i].nome + " - " + data.subcreditos[i].numero
              }
            }

            self.pessoaJuridicaService.recuperaEmpresaPorCnpj(eventoRepasse.args.toCnpj).subscribe(
              data => {
                console.log(data)
                let toRazaoSocial = data.dadosCadastrais.razaoSocial

                transferencia = {
                  deRazaoSocial: fromRazaoSocial,
                  deCnpj: eventoRepasse.args.fromCnpj,
                  deConta: subcredito,
                  paraRazaoSocial: toRazaoSocial,
                  paraCnpj: eventoRepasse.args.toCnpj,
                  paraConta: "-",
                  valor: self.web3Service.converteInteiroParaDecimal(parseInt(eventoRepasse.args.valor)),
                  tipo: "Repasse",
                  hashID: eventoRepasse.transactionHash,
                  dataHora: null
                };

                // Colocar dentro da zona do Angular para ter a atualização de forma correta
                self.zone.run(() => {
                  self.listaTransferencias.push(transferencia);
                  self.estadoLista = "cheia"
                })

                // self.contadorTransferencia++;
                // self.volumeTransferencia +=  self.web3Service.converteInteiroParaDecimal( parseInt( eventoRepasse.args.valor ) );

                // self.pieChartData.dataTable[2][1] = self.contadorTransferencia;
                // self.barChartData.dataTable[2][1] = self.volumeTransferencia;

                // self.atualizaGrafico();

                // console.log("inseriu transf " + transferencia.hashID);
                // console.log("contador transf " + self.contadorTransferencia);
                // console.log("volume transf " + self.volumeTransferencia);

                self.web3Service.getBlockTimestamp(eventoRepasse.blockHash,
                  function (error, result) {
                    if (!error) {
                      transferencia.dataHora = new Date(result.timestamp * 1000);
                      self.ref.detectChanges();
                    } else {
                      console.log("Erro ao recuperar data e hora do bloco");
                      console.error(error);
                    }
                  });
              })
          })
      } else {
        console.log("Erro no registro de eventos transferência");
        console.log(error);
      }

    });
  }

  registrarExibicaoEventosResgate() {
    let self = this

    this.web3Service.registraEventosResgate(function (error, event) {
      if (!error) {
        let resgate: DashboardTransferencia;
        let eventoResgate = event

        self.pessoaJuridicaService.recuperaEmpresaPorCnpj(eventoResgate.args.cnpj).subscribe(
          data => {
            resgate = {
              deRazaoSocial: data.dadosCadastrais.razaoSocial,
              deCnpj: eventoResgate.args.cnpj,
              deConta: "-",
              paraRazaoSocial: self.razaoSocialBNDES,
              paraCnpj: "BNDES",
              paraConta: "-",
              valor: self.web3Service.converteInteiroParaDecimal(parseInt(eventoResgate.args.valor)),
              tipo: "Resgate",
              hashID: eventoResgate.transactionHash,
              dataHora: null
            };

            // Colocar dentro da zona do Angular para ter a atualização de forma correta
            self.zone.run(() => {
              self.listaTransferencias.push(resgate);
              self.estadoLista = "cheia"
            });

            self.contadorResgate++;
            self.volumeResgate += self.web3Service.converteInteiroParaDecimal(parseInt(eventoResgate.args.valor));

            self.pieChartData.dataTable[3][1] = self.contadorResgate;
            self.barChartData.dataTable[3][1] = self.volumeResgate;

            self.atualizaGrafico();

            console.log("inseriu resg " + resgate.hashID);
            console.log("contador resg " + self.contadorResgate);
            console.log("volume resg " + self.volumeResgate);

            self.web3Service.getBlockTimestamp(eventoResgate.blockHash,
              function (error, result) {
                if (!error) {
                  resgate.dataHora = new Date(result.timestamp * 1000);
                  self.ref.detectChanges();
                }
                else {
                  console.log("Erro ao recuperar data e hora do bloco");
                  console.error(error);
                }
              });

          })
      }
      else {
        console.log("Erro no registro de eventos de resgate");
        console.log(error);
      }

    });
  }

  registrarExibicaoEventosLiquidacaoResgate() {
    let self = this

    this.web3Service.registraEventosLiquidacaoResgate(function (error, event) {
      if (!error) {

        let eventoLiquidacao = event
        let resgate: LiquidacaoResgate

        self.pessoaJuridicaService.buscaLiquidacaoResgatePorHash(eventoLiquidacao.transactionHash).subscribe(
          data => {
            console.log("Encontrou algum dado")

            let valorResgate
            let liquidacao: DashboardTransferencia;

            if (data) {
              console.log("Alguma empresa encontrada.")

              self.web3Service.registraEventosResgate(function (error, result) {
                if (!error && data.hashOperacao === result.transactionHash) {
                  valorResgate = self.web3Service.converteInteiroParaDecimal(parseInt(result.args.valor))

                  liquidacao = {
                    deRazaoSocial: self.razaoSocialBNDES,
                    deCnpj: "BNDES",
                    deConta: "-",
                    paraRazaoSocial: data.razaoSocialOrigem,
                    paraCnpj: data.cnpjOrigem,
                    paraConta: "-",
                    valor: valorResgate,
                    tipo: "Liquidação Resgate",
                    hashID: eventoLiquidacao.transactionHash,
                    dataHora: null
                  };

                  // Colocar dentro da zona do Angular para ter a atualização de forma correta
                  self.zone.run(() => {
                    self.listaTransferencias.push(liquidacao);
                    self.estadoLista = "cheia"

                    self.contadorLiquidacao++;
                    self.volumeLiquidacao += 1 * valorResgate;

                    self.pieChartData.dataTable[4][1] = self.contadorLiquidacao;
                    self.barChartData.dataTable[4][1] = self.volumeLiquidacao;

                    self.atualizaGrafico()

                    self.web3Service.getBlockTimestamp(eventoLiquidacao.blockHash,
                      function (error, date) {
                        if (!error) {
                          liquidacao.dataHora = new Date(date.timestamp * 1000);
                          self.ref.detectChanges();
                        }
                        else {
                          console.log("Erro ao recuperar data e hora do bloco");
                          console.error(error);
                        }
                      });

                    console.log("self.volumeLiquidacao=" + self.volumeLiquidacao)

                  });
                } else {
                  console.log("Erro ao recuperar registros de evento resgate")
                }
              });

            } else {
              console.log("Nenhuma empresa encontrada.")
              resgate.razaoSocial = ""
              resgate.banco = 0
              resgate.agencia = 0
              resgate.contaCorrente = 0
              resgate.contaBlockchain = ""
              resgate.hashID = ""
            }

            console.log(resgate)
            self.isActive = new Array(self.listaTransferencias.length).fill(false)
          },
          error => {
            console.log("Erro ao buscar dados da empresa.")
            resgate.razaoSocial = ""
            resgate.banco = 0
            resgate.agencia = 0
            resgate.contaCorrente = 0
            resgate.contaBlockchain = ""
          })

      }
      else {
        console.log("Erro no registro de eventos de liquidacao");
        console.log(error);
      }


    });
  }

}

