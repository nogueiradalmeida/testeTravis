import { Component, OnInit, NgZone } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { DashboardPessoaJuridica } from './DashboardPessoaJuridica';
import { Web3Service } from './../Web3Service';
import { PessoaJuridicaService } from '../pessoa-juridica.service';
import { LogSol } from '../LogSol';


import { BnAlertsService } from 'bndes-ux4';

@Component({
    selector: 'app-dashboard-id-empresa',
    templateUrl: './dashboard-id-empresa.component.html',
    styleUrls: ['./dashboard-id-empresa.component.css']
})



export class DashboardIdEmpresaComponent implements OnInit {

    listaTransacoesPJ: DashboardPessoaJuridica[] = undefined;
    estadoLista: string = "undefined";

    p: number = 1;
    order: string = 'dataHora';
    reverse: boolean = false;

    constructor(private pessoaJuridicaService: PessoaJuridicaService, protected bnAlertsService: BnAlertsService, private web3Service: Web3Service,
        private ref: ChangeDetectorRef, private zone: NgZone) {

    }

    ngOnInit() {
        setTimeout(() => {
            this.listaTransacoesPJ = [];
            console.log("Zerou lista de transacoes");

            this.registrarExibicaoCadadastro();
            this.registrarLogSolidity();
        }, 1500)

        setTimeout(() => {
            this.estadoLista = this.estadoLista === "undefined" ? "vazia" : "cheia"
            this.ref.detectChanges()
        }, 2000)
    }

    registrarLogSolidity() {
        let self = this;

        this.web3Service.registraEventosLog(function (error, event) {

            let eventoLog: LogSol;

            if (!error) {
                eventoLog = {
                    a: event.args.a,
                    b: event.args.b
                }

                console.log(eventoLog.a + eventoLog.b);
            }
            else {
                console.log("Erro no registro de eventos de log solidity");
                console.log(error);
            }
        });
    }

    registrarExibicaoCadadastro() {

        let self = this;

        this.web3Service.registraEventosCadastro(function (error, event) {

            if (!error) {

                let transacaoPJ: DashboardPessoaJuridica;
                let eventoCadastro = event

                console.log("Evento Cadastro");
                console.log(eventoCadastro);

                self.web3Service.accountIsActive(eventoCadastro.args.endereco,
                    (result) => {

                        let status

                        if (result) {
                            status = "OK"
                        } else {
                            status = "Desativada"
                        }

                        transacaoPJ = {
                            cnpj: eventoCadastro.args.cnpj,
                            razaoSocial: "",
                            contaBlockchain: eventoCadastro.args.endereco,
                            hashID: eventoCadastro.transactionHash,
                            dataHora: null,
                            nomeConta: eventoCadastro.args.idSubcredito,
                            status: status
                        };


                        self.pessoaJuridicaService.recuperaEmpresaPorCnpj(transacaoPJ.cnpj).subscribe(
                            data => {
                                console.log("Encontrou algum dado");
                                transacaoPJ.razaoSocial = data.dadosCadastrais.razaoSocial;

                                // Colocar dentro da zona do Angular para ter a atualização de forma correta
                                self.zone.run(() => {
                                    self.listaTransacoesPJ.push(transacaoPJ);
                                    self.estadoLista = "cheia"
                                    console.log("inseriu transacao cadastro");
                                });

                            },
                            error => {
                                console.log("Erro ao buscar dados da empresa");
                                transacaoPJ.razaoSocial = "";
                                transacaoPJ.contaBlockchain = "";
                            });

                        self.web3Service.getBlockTimestamp(eventoCadastro.blockHash,
                            function (error, result) {
                                if (!error) {
                                    transacaoPJ.dataHora = new Date(result.timestamp * 1000);
                                    self.ref.detectChanges();
                                }
                                else {
                                    console.log("Erro ao recuperar data e hora do bloco");
                                    console.error(error);
                                }
                            });
                    },
                    (error) => {
                        console.log("Erro ao verificar se a conta está ativa")
                    })
            } else {
                console.log("Erro no registro de eventos de cadastro");
                console.log(error);
            }
        });

        self.web3Service.registraEventosTroca(function (error, event) {

            let transacaoPJ: DashboardPessoaJuridica
            let eventoTroca = event

            console.log("Evento Troca");
            console.log(eventoTroca);

            if (!error) {

                self.web3Service.accountIsActive(eventoTroca.args.endereco,
                    (result) => {

                        let status

                        if (result) {
                            status = "OK"
                        } else {
                            status = "Desativada"
                        }

                        transacaoPJ = {
                            cnpj: eventoTroca.args.cnpj,
                            razaoSocial: "",
                            contaBlockchain: eventoTroca.args.endereco,
                            hashID: eventoTroca.transactionHash,
                            dataHora: null,
                            nomeConta: eventoTroca.args.idSubcredito,
                            status: status
                        };

                        self.pessoaJuridicaService.recuperaEmpresaPorCnpj(transacaoPJ.cnpj).subscribe(
                            data => {
                                console.log("Encontrou algum dado");
                                transacaoPJ.razaoSocial = data.dadosCadastrais.razaoSocial;

                                // Colocar dentro da zona do Angular para ter a atualização de forma correta
                                self.zone.run(() => {
                                    self.listaTransacoesPJ.push(transacaoPJ);
                                    self.estadoLista = "cheia"
                                    console.log("inseriu transacao Troca");
                                });

                            },
                            error => {
                                console.log("Erro ao buscar dados da empresa");
                                transacaoPJ.razaoSocial = "";
                                transacaoPJ.contaBlockchain = "";
                            });

                        self.web3Service.getBlockTimestamp(eventoTroca.blockHash,
                            function (error, result) {
                                if (!error) {
                                    transacaoPJ.dataHora = new Date(result.timestamp * 1000);
                                    self.ref.detectChanges();
                                }
                                else {
                                    console.log("Erro ao recuperar data e hora do bloco");
                                    console.error(error);
                                }
                            });
                    }, (error) => {
                        console.log("Erro ao verificar se a conta está ativa")
                    })

            } else {

            }
        })
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

}
