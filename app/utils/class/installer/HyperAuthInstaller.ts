/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import YAML from 'yaml';
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';

import * as Common from '../../common/common';
import Node from '../Node';
import CONST from '../../constants/constant';

export default class HyperAuthInstaller extends AbstractInstaller {
  public static readonly IMAGE_DIR = `install-hyperauth`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/install-hyperauth`;

  public static readonly IMAGE_HOME = `${Env.INSTALL_ROOT}/${HyperAuthInstaller.IMAGE_DIR}`;

  public static readonly POSTGRES_VERSION = `9.6.2-alpine`;

  public static readonly HYPERAUTH_VERSION = `1.0.11.5`;

  // singleton
  private static instance: HyperAuthInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!HyperAuthInstaller.instance) {
      HyperAuthInstaller.instance = new HyperAuthInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any; setProgress: Function }) {
    const { callback, setProgress } = param;

    setProgress(10);
    await this.preWorkInstall({
      callback
    });
    setProgress(60);
    await this._installMainMaster(callback);
    setProgress(100);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    // await this._copyFile(callback);
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      await this.downloadImageFile();
      await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      await this.registryWork({
        callback
      });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  protected async downloadImageFile() {
    // TODO: download image file
    console.debug(
      '@@@@@@ Start downloading the image file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the image file to client local... ######'
    );
  }

  protected async sendImageFile() {
    console.debug(
      '@@@@@@ Start sending the image file to main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${HyperAuthInstaller.IMAGE_DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${HyperAuthInstaller.IMAGE_HOME}/`
    );
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

  protected downloadGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected sendGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.cloneGitFile(
      CONST.HYPERAUTH_REPO,
      CONST.GIT_BRANCH
    );
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  protected async registryWork(param: { callback: any }) {
    console.debug(
      '@@@@@@ Start pushing the image at main master node... @@@@@@'
    );
    const { callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this.getImagePushScript();
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(): string {
    let gitPullCommand = `
    mkdir -p ~/${HyperAuthInstaller.IMAGE_HOME};
    export HYPERAUTH_HOME=~/${HyperAuthInstaller.IMAGE_HOME};
    export POSTGRES_VERSION=${HyperAuthInstaller.POSTGRES_VERSION};
    export HYPERAUTH_VERSION=${HyperAuthInstaller.HYPERAUTH_VERSION};
    export REGISTRY=${this.env.registry};
    cd $HYPERAUTH_HOME;
    `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
      sudo docker load < postgres_\${POSTGRES_VERSION}.tar;
      sudo docker load < hyperauth_b\${HYPERAUTH_VERSION}.tar;
      # sudo docker save tmaxcloudck/hyperauth:b\${HYPERAUTH_VERSION} > hyperauth_b\${HYPERAUTH_VERSION}.tar;
      # sudo docker save postgres:\${POSTGRES_VERSION} > postgres_\${POSTGRES_VERSION}.tar;
      `;
    } else {
      gitPullCommand += `
      sudo docker pull postgres:\${POSTGRES_VERSION};
      sudo docker pull tmaxcloudck/hyperauth:b\${HYPERAUTH_VERSION};
      `;
    }
    return `
      ${gitPullCommand}
      sudo docker tag postgres:\${POSTGRES_VERSION} \${REGISTRY}/postgres:\${POSTGRES_VERSION}
      sudo docker tag tmaxcloudck/hyperauth:b\${HYPERAUTH_VERSION}; \${REGISTRY}/tmaxcloudck/hyperauth:b\${HYPERAUTH_VERSION};

      sudo docker push \${REGISTRY}/postgres:\${POSTGRES_VERSION}
      sudo docker push \${REGISTRY}/tmaxcloudck/hyperauth:b\${HYPERAUTH_VERSION};
      #rm -rf $HYPERAUTH_HOME;
      `;
  }

  public async realmImport(param: {
    state: any;
    callback: any;
    setProgress: Function;
  }) {
    const { state, callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();

    // FIXME: targetEmail, targetPassword 값 변경 될 가능성 있음
    const targetEmail = 'hc-admin@tmax.co.kr';
    const targetPassword = 'Tmaxadmin1!';
    const newEmail = state.email;
    const newPassword = state.password;

    mainMaster.cmd = `
    export HYPERAUTH_SERVICE_IP=\`kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    export HYPERCLOUD_CONSOLE_IP=\`kubectl describe service console-lb -n console-system | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    \\cp ~/${HyperAuthInstaller.INSTALL_HOME}/manifest/tmaxRealmImport.sh ~/${HyperAuthInstaller.INSTALL_HOME}/manifest/tmaxRealmImportCopy.sh;
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    sed -i 's|\\r$||g' tmaxRealmImportCopy.sh;
    sed -i 's/${targetEmail}/${newEmail}/g' tmaxRealmImportCopy.sh;
    sed -i 's/${targetPassword}/${newPassword}/g' tmaxRealmImportCopy.sh;
    chmod 755 tmaxRealmImportCopy.sh;
    ./tmaxRealmImportCopy.sh \${HYPERAUTH_SERVICE_IP} \${HYPERCLOUD_CONSOLE_IP};
    `;
    await mainMaster.exeCmd(callback);
  }

  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 1. 초기화 작업
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    // 특정 pod가 뜨고 난 후 다음 작업 해야함
    // 2분 대기
    await new Promise(resolve => setTimeout(resolve, 120000));

    // Step 2. SSL 인증서 생성
    mainMaster.cmd = this._step2(mainMaster.os.type);
    await mainMaster.exeCmd(callback);

    // 인증서 다른 마스터들에게 복사
    mainMaster.cmd = this._cpSSLtoMaster();
    await mainMaster.exeCmd(callback);

    // Step 3. HyperAuth Deployment 배포
    mainMaster.cmd = this._step3();
    await mainMaster.exeCmd(callback);

    // Step 4. Kubernetes OIDC 연동
    await this._step4();

    console.debug('###### Finish installing main Master... ######');
  }

  private _step1(): string {
    let script = `cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;`;

    // 개발 환경에서는 테스트 시, POD의 메모리를 조정하여 테스트
    if (process.env.RESOURCE === 'low') {
      script += `
      sed -i 's/cpu: "300m"/cpu: "0.5"/g' 1.initialization.yaml;
      sed -i 's/memory: "300Mi"/memory: "500Mi"/g' 1.initialization.yaml;
      `;
    }
    script += `
    kubectl apply -f 1.initialization.yaml;
    `;

    return script;
  }

  private _step2(osType: string): string {
    return `
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    openssl req -newkey rsa:4096 -nodes -sha256 -keyout hyperauth.key -x509 -subj "/C=KR/ST=Seoul/O=tmax/CN=$(kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7)" -days 3650 -config <(cat /etc/pki/tls/openssl.cnf <(printf "[v3_ca]\nsubjectAltName=IP:$(kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7)")) -out hyperauth.crt;
    kubectl create secret tls hyperauth-https-secret --cert=./hyperauth.crt --key=./hyperauth.key -n hyperauth;
    cp hyperauth.crt /etc/kubernetes/pki/hyperauth.crt;
    `;
  }

  private _cpSSLtoMaster() {
    const { masterArr } = this.env.getNodesSortedByRole();
    let copyScript = '';
    masterArr.map(master => {
      copyScript += `sshpass -p '${master.password}' scp -P ${master.port} -o StrictHostKeyChecking=no ./hyperauth.crt ${master.user}@${master.ip}:/etc/kubernetes/pki/hyperauth.crt;`;
    });

    return `
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    ${copyScript}
    `;
  }

  private _step3(): string {
    let script = `cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;`;

    // 개발 환경에서는 테스트 시, POD의 메모리를 조정하여 테스트
    if (process.env.RESOURCE === 'low') {
      script += `
      sed -i 's/memory: "300Mi"/memory: "500Mi"/g' 2.hyperauth_deployment.yaml;
      sed -i 's/cpu: "300m"/cpu: "0.5"/g' 2.hyperauth_deployment.yaml;
      `;
    }
    script += `
    kubectl apply -f 2.hyperauth_deployment.yaml;
    `;

    return script;
  }

  private async _step4() {
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();

    let hyperAuthServiceIp: any;
    mainMaster.cmd = `kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7;`;
    await mainMaster.exeCmd({
      close: () => {},
      stdout: (data: string) => {
        hyperAuthServiceIp = data
          .toString()
          .replace(/\r/g, '')
          .replace(/\n/g, '');
      },
      stderr: () => {}
    });

    // FIXME:
    // 일단 --oidc 부분 있으면 삭제
    // hyperauth 삭제 할 때 --oidc부분을 삭제하면
    // api-server가 에러남
    // 그래서 설치 전에 해주는 것으로 임시로 변경해놓음
    await this.rollbackApiServerYaml([...masterArr, mainMaster]);

    mainMaster.cmd = `cat /etc/kubernetes/manifests/kube-apiserver.yaml;`;
    let apiServerYaml: any;
    await mainMaster.exeCmd({
      close: () => {},
      stdout: (data: string) => {
        apiServerYaml = YAML.parse(data.toString());
      },
      stderr: () => {}
    });
    // console.error('before apiServerYaml', apiServerYaml);
    apiServerYaml.spec.containers[0].command.push(`%%--oidc-issuer-url%%`);
    apiServerYaml.spec.containers[0].command.push(
      `--oidc-client-id=hypercloud4`
    );
    apiServerYaml.spec.containers[0].command.push(
      `--oidc-username-claim=preferred_username`
    );
    apiServerYaml.spec.containers[0].command.push(`--oidc-username-prefix=-`);
    apiServerYaml.spec.containers[0].command.push(`--oidc-groups-claim=group`);
    apiServerYaml.spec.containers[0].command.push(
      `--oidc-ca-file=/etc/kubernetes/pki/hyperauth.crt`
    );

    // console.error('after apiServerYaml', YAML.stringify(apiServerYaml));
    mainMaster.cmd = `
    # export hyperAuthServiceIp=\`kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    # echo $hyperAuthServiceIp;
    echo "${YAML.stringify(
      apiServerYaml
    )}" > /etc/kubernetes/manifests/kube-apiserver.yaml;
    sudo sed -i "s|%%--oidc-issuer-url%%|--oidc-issuer-url=https://${hyperAuthServiceIp}/auth/realms/tmax|g" /etc/kubernetes/manifests/kube-apiserver.yaml;
    `;
    await mainMaster.exeCmd();

    await Common.waitApiServerUntilNormal(mainMaster);

    // 다른 마스터에도 적용
    await Promise.all(
      masterArr.map(async (master: Node) => {
        master.cmd = `cat /etc/kubernetes/manifests/kube-apiserver.yaml;`;
        await master.exeCmd({
          close: () => {},
          stdout: (data: string) => {
            apiServerYaml = YAML.parse(data.toString());
          },
          stderr: () => {}
        });
        // console.error('before apiServerYaml', apiServerYaml);
        apiServerYaml.spec.containers[0].command.push(`%%--oidc-issuer-url%%`);
        apiServerYaml.spec.containers[0].command.push(
          `--oidc-client-id=hypercloud4`
        );
        apiServerYaml.spec.containers[0].command.push(
          `--oidc-username-claim=preferred_username`
        );
        apiServerYaml.spec.containers[0].command.push(
          `--oidc-username-prefix=-`
        );
        apiServerYaml.spec.containers[0].command.push(
          `--oidc-groups-claim=group`
        );
        apiServerYaml.spec.containers[0].command.push(
          `--oidc-ca-file=/etc/kubernetes/pki/hyperauth.crt`
        );

        // console.error('after apiServerYaml', YAML.stringify(apiServerYaml));
        master.cmd = `
        # export hyperAuthServiceIp=\`kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
        # echo $hyperAuthServiceIp;
        echo "${YAML.stringify(
          apiServerYaml
        )}" > /etc/kubernetes/manifests/kube-apiserver.yaml;
        sudo sed -i "s|%%--oidc-issuer-url%%|--oidc-issuer-url=https://${hyperAuthServiceIp}/auth/realms/tmax|g" /etc/kubernetes/manifests/kube-apiserver.yaml;
        `;
        await master.exeCmd();
      })
    );
  }

  private async rollbackApiServerYaml(targetList: Node[]) {
    // const { mainMaster } = this.env.getNodesSortedByRole();

    console.error(targetList);

    await Promise.all(
      targetList.map(async node => {
        node.cmd = `cat /etc/kubernetes/manifests/kube-apiserver.yaml;`;
        let apiServerYaml;
        await node.exeCmd({
          close: () => {},
          stdout: (data: string) => {
            apiServerYaml = YAML.parse(data.toString());
          },
          stderr: () => {}
        });
        apiServerYaml.spec.containers[0].command = apiServerYaml.spec.containers[0].command.filter(
          (cmd: string | string[]) => {
            return cmd.indexOf('--oidc') === -1;
          }
        );

        node.cmd = `
        echo "${YAML.stringify(
          apiServerYaml
        )}" > /etc/kubernetes/manifests/kube-apiserver.yaml;
        `;
        await node.exeCmd();

        // oidc 부분 삭제하고 다시 넣어주기 때문에
        // api 서버 정상동작 확인할 필요 없음
        // await Common.waitApiServerUntilNormal(node);
      })
    );
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();

    // FIXME: kube-apiserver.yaml 수정하면, api server 고장남
    // await this.rollbackApiServerYaml([...masterArr, mainMaster]);
    console.debug('###### Finish remove main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    kubectl delete -f 2.hyperauth_deployment.yaml;
    kubectl delete secret hyperauth-https-secret -n hyperauth;
    # rm -rf /etc/kubernetes/pki/hyperauth.crt;
    kubectl delete -f 1.initialization.yaml;
    rm -rf ~/${HyperAuthInstaller.INSTALL_HOME};
    `;
  }

  private async _copyFile(callback: any) {
    console.debug('@@@@@@ Start copy yaml file... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = `
    \\cp -r ~/${HyperAuthInstaller.INSTALL_HOME}/manifest ~/${HyperAuthInstaller.INSTALL_HOME}/manifest;
    `;
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish copy yaml file... ######');
  }
}
